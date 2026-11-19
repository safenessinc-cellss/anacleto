import {
  collection,
  doc,
  getDocs,
  writeBatch,
  type Firestore,
} from "firebase/firestore";
import {
  mapLegacySupplierCatalogRow,
  type LegacyCatalogCandidate,
  type LegacySupplierCatalogRow,
} from "./legacyCatalogMigration";

const LEGACY_COLLECTIONS = ["supplier_catalog", "catalog", "registry_items", "price_table"] as const;
const REVIEW_COLLECTION = "technical_catalog_review";

export interface LegacyReviewQueueResult {
  scanned: number;
  queued: number;
  alreadyQueued: number;
}

/**
 * Copies legacy rows into a review queue without changing or deleting source data.
 * Candidate IDs are deterministic, so rerunning the import does not duplicate rows.
 * No legacy price or compatibility is promoted to verified automatically.
 */
export async function queueLegacyCatalogReview(db: Firestore): Promise<LegacyReviewQueueResult> {
  const snapshots = await Promise.all(
    LEGACY_COLLECTIONS.map((name) => getDocs(collection(db, name))),
  );
  const existingSnapshot = await getDocs(collection(db, REVIEW_COLLECTION));
  const existingIds = new Set(existingSnapshot.docs.map((item) => item.id));

  const pending: Array<{ id: string; candidate: LegacyCatalogCandidate; sourceData: Record<string, unknown> }> = [];
  let scanned = 0;

  snapshots.forEach((snapshot, index) => {
    const legacyCollection = LEGACY_COLLECTIONS[index];
    snapshot.docs.forEach((sourceDoc) => {
      scanned += 1;
      const sourceData = sourceDoc.data();
      const row: LegacySupplierCatalogRow = {
        id: sourceDoc.id,
        supplier: sourceData.supplier ?? sourceData.brand ?? sourceData.manufacturer,
        code: sourceData.code ?? sourceData.sku ?? sourceData.reference,
        name: sourceData.name ?? sourceData.description ?? sourceData.title,
        description: sourceData.description,
        category: sourceData.category ?? sourceData.type,
        unit: sourceData.unit ?? sourceData.measurementUnit,
        price: sourceData.price ?? sourceData.value,
        lengthMm: sourceData.lengthMm ?? sourceData.commercialLengthMm,
        color: sourceData.color ?? sourceData.finish,
        material: sourceData.material,
        sourceUrl: sourceData.sourceUrl ?? sourceData.url,
        sourceDocument: typeof sourceData.sourceDocument === "string" && !sourceData.sourceDocument.startsWith("data:") && sourceData.sourceDocument.length <= 500
          ? sourceData.sourceDocument
          : sourceData.fileName,
        createdAt: sourceData.createdAt,
      };
      const candidate = mapLegacySupplierCatalogRow(row, legacyCollection);
      const id = encodeURIComponent(legacyCollection + "__" + sourceDoc.id);
      // Never copy base64 images, PDF payloads, or arbitrary legacy fields into Firestore.
      const sourceDataForReview = Object.fromEntries(
        ["supplier", "brand", "manufacturer", "code", "sku", "reference", "name", "description",
          "title", "category", "type", "unit", "measurementUnit", "price", "value", "lengthMm",
          "commercialLengthMm", "color", "finish", "material", "sourceUrl", "url", "sourceDocument",
          "fileName", "createdAt"].filter((key) => {
            const value = sourceData[key];
            return value !== undefined
              && !(typeof value === "string" && (value.startsWith("data:") || value.length > 2048));
          }).map((key) => [key, sourceData[key]]),
      );
      if (!existingIds.has(id)) pending.push({ id, candidate, sourceData: sourceDataForReview });
    });
  });

  for (let offset = 0; offset < pending.length; offset += 400) {
    const batch = writeBatch(db);
    pending.slice(offset, offset + 400).forEach(({ id, candidate, sourceData }) => {
      batch.set(doc(db, REVIEW_COLLECTION, id), {
        ...candidate,
        sourceCollection: candidate.legacyCollection,
        sourceDocumentId: candidate.legacyId,
        sourceData,
        status: "pending_review",
        importedAt: new Date().toISOString(),
        schemaVersion: 1,
      });
    });
    await batch.commit();
  }

  return {
    scanned,
    queued: pending.length,
    alreadyQueued: scanned - pending.length,
  };
}
