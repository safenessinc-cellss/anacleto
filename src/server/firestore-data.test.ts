import test from "node:test";
import assert from "node:assert/strict";
import {
  loadCatalogFromFirestore,
  refreshCatalogMatchesFromFirestore,
} from "./firestore-data.js";

const request = { headers: { authorization: "Bearer unit-test-token" } };
const originalFetch = globalThis.fetch;

test("catalog cache avoids repeating four full Firestore reads during its TTL", async () => {
  let calls = 0;
  globalThis.fetch = (async (input: RequestInfo | URL) => {
    calls += 1;
    const collection = new URL(String(input)).pathname.split("/").pop() || "catalog";
    const document = {
      name: `projects/test/databases/(default)/documents/${collection}/item-${collection}`,
      fields: {
        name: { stringValue: `Item ${collection}` },
        sku: { stringValue: `SKU-${collection}` },
        price: { doubleValue: 10 },
      },
    };
    return new Response(JSON.stringify({ documents: [document] }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const first = await loadCatalogFromFirestore(request, { cacheTtlMs: 20_000, cacheKey: "test-user" });
    assert.equal(first.length, 4);
    assert.equal(calls, 4);

    const second = await loadCatalogFromFirestore(request, { cacheTtlMs: 20_000, cacheKey: "test-user" });
    assert.equal(second.length, 4);
    assert.equal(calls, 4);

    const otherUser = await loadCatalogFromFirestore(request, { cacheTtlMs: 20_000, cacheKey: "other-user" });
    assert.equal(otherUser.length, 4);
    assert.equal(calls, 8);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("catalog price refresh uses current Firestore values before quote pricing", async () => {
  globalThis.fetch = (async () => {
    const result = {
      found: {
        name: "projects/test/databases/(default)/documents/catalog/window-1",
        fields: {
          name: { stringValue: "Janela de correr" },
          sku: { stringValue: "JCR-01" },
          price: { doubleValue: 129.9 },
          status: { stringValue: "verified" },
        },
      },
    };
    return new Response(JSON.stringify(result) + "\n", {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }) as typeof fetch;

  try {
    const cached = [{
      id: "window-1",
      source: "catalog",
      name: "Janela de correr",
      sku: "JCR-01",
      price: 99,
      status: "verified",
    }];
    const refreshed = await refreshCatalogMatchesFromFirestore(
      request,
      cached,
      [{ catalogItemId: "window-1", sku: "JCR-01" }],
    );
    assert.equal(refreshed[0].price, 129.9);
    assert.equal(refreshed[0].status, "verified");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("missing catalog document is downgraded to pending instead of using a stale price", async () => {
  globalThis.fetch = (async () => new Response(
    JSON.stringify({ missing: "projects/test/databases/(default)/documents/catalog/window-404" }) + "\n",
    { status: 200, headers: { "Content-Type": "application/json" } },
  )) as typeof fetch;

  try {
    const cached = [{
      id: "window-404",
      source: "catalog",
      name: "Janela removida",
      sku: "OLD-01",
      price: 250,
      status: "verified",
    }];
    const refreshed = await refreshCatalogMatchesFromFirestore(
      request,
      cached,
      [{ catalogItemId: "window-404", sku: "OLD-01" }],
    );
    assert.equal(refreshed[0].price, 0);
    assert.equal(refreshed[0].status, "rejected");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
