import React, { useCallback, useEffect, useRef } from "react";
import PublicAssemblyIntro from "./PublicAssemblyIntro";

interface AnimatedWindowLoaderProps {
  onFinish: () => void;
  currentLanguage: string;
}

/**
 * Reutiliza a introdução 3D aprovada como splash de entrada do painel.
 * O dashboard, sua navegação e seus módulos permanecem intocados.
 */
export default function AnimatedWindowLoader({ onFinish }: AnimatedWindowLoaderProps) {
  const onFinishRef = useRef(onFinish);

  useEffect(() => {
    onFinishRef.current = onFinish;
  }, [onFinish]);

  const finish = useCallback(() => {
    onFinishRef.current();
  }, []);

  return <PublicAssemblyIntro onComplete={finish} onSkip={finish} />;
}
