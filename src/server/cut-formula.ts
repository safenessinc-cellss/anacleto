/** Safe arithmetic evaluator for technical cut/consumption formulas.
 * Supported variables: W/L (width mm), H (height mm), Q (quantity per unit; normally 1).
 * Supported operators: + - * / and parentheses. No eval or arbitrary JavaScript.
 */
export function evaluateTechnicalFormula(source: string, vars: Record<string, number>): number {
  const tokens = source.match(/[A-Za-z_][A-Za-z0-9_]*|(?:\d+(?:\.\d*)?|\.\d+)|[()+\-*/]/g) || [];
  if (!tokens.length || tokens.join("") !== source.replace(/\s+/g, "")) {
    throw new Error("Fórmula contém caracteres não permitidos.");
  }
  let index = 0;
  const expression = (): number => {
    let value = term();
    while (tokens[index] === "+" || tokens[index] === "-") {
      const op = tokens[index++];
      const rhs = term();
      value = op === "+" ? value + rhs : value - rhs;
    }
    return value;
  };
  const term = (): number => {
    let value = factor();
    while (tokens[index] === "*" || tokens[index] === "/") {
      const op = tokens[index++];
      const rhs = factor();
      if (op === "/" && rhs === 0) throw new Error("Divisão por zero na fórmula.");
      value = op === "*" ? value * rhs : value / rhs;
    }
    return value;
  };
  const factor = (): number => {
    const token = tokens[index++];
    if (token === "+" || token === "-") {
      const value = factor();
      return token === "-" ? -value : value;
    }
    if (token === "(") {
      const value = expression();
      if (tokens[index++] !== ")") throw new Error("Parênteses não fechados na fórmula.");
      return value;
    }
    if (!token) throw new Error("Fórmula incompleta.");
    if (/^(?:\d+(?:\.\d*)?|\.\d+)$/.test(token)) return Number(token);
    const key = token.toUpperCase();
    if (!(key in vars) || !Number.isFinite(vars[key])) throw new Error("Variável não permitida na fórmula: " + token);
    return vars[key];
  };
  const result = expression();
  if (index !== tokens.length || !Number.isFinite(result) || result <= 0) {
    throw new Error("Resultado inválido na fórmula.");
  }
  return result;
}
