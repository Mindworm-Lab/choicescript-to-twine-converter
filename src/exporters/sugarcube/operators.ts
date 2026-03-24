/**
 * Translate a ChoiceScript expression string to SugarCube 2 JavaScript syntax.
 *
 * Key differences:
 *   CS equality: =   → JS: ===
 *   CS inequality: !=  → JS: !==
 *   CS string vars: "${var}" → SugarCube: $var
 *   CS boolean literals: true/false → same in JS
 */
export function translateExpr(expr: string): string {
  let result = expr.trim();

  // Replace 'and', 'or', 'not' with JS equivalents first
  result = result.replace(/\band\b/g, '&&');
  result = result.replace(/\bor\b/g, '||');
  result = result.replace(/\bnot\b/g, '!');

  // Equality: single = used as comparison → ===
  // Strategy: replace standalone = that isn't preceded by !, <, >, +, -, *, /, or another =
  result = result.replace(/(?<![!<>=+\-*/])=(?!=)/g, '===');
  // Fix any triple === created by the above
  result = result.replace(/!===/g, '!==');

  // CS string interpolation in expressions: ${var} → just the var name (for SC it will be $var)
  result = result.replace(/\$\{(\w+)\}/g, '$1');

  // Prefix bare variable identifiers with $ for SugarCube
  result = prefixVariables(result);

  return result;
}

/**
 * Translate a *set expression. Simply translates the expression —
 * variable prefixing is handled by prefixVariables inside translateExpr.
 */
export function translateSetExpr(_name: string, expr: string): string {
  return translateExpr(expr);
}

/**
 * Prefix bare identifier words in a CS expression with $ for SugarCube variables.
 * Skips: JS keywords, numeric literals, string literals, already-prefixed vars.
 */
function prefixVariables(expr: string): string {
  const JS_KEYWORDS = new Set([
    'true', 'false', 'null', 'undefined',
    'if', 'else', 'return',
    'Math', 'min', 'max', 'abs', 'floor', 'ceil', 'round',
  ]);

  // Don't touch content inside string literals
  // Split on string literals to avoid replacing inside them
  const parts = expr.split(/(["'][^"']*["'])/g);
  return parts.map((part, i) => {
    // Odd indices are string literals — leave unchanged
    if (i % 2 === 1) return part;
    // Prefix bare identifiers that aren't already prefixed with $
    return part.replace(/(?<!\$)\b([a-zA-Z_]\w*)\b(?!\s*\()/g, (match) => {
      if (JS_KEYWORDS.has(match)) return match;
      return `$${match}`;
    });
  }).join('');
}

/**
 * Convert ChoiceScript variable interpolation in narrative text to SugarCube <<print>>.
 *
 * IMPORTANT: all .replace() calls use function callbacks, never string replacement
 * patterns, because string patterns treat $ specially ($1, $&, $$, etc.) which
 * corrupts the output when variable names or markup contain $ characters.
 *
 *   $!{var}   → <<print $var.charAt(0).toUpperCase() + $var.slice(1)>>
 *   $${var}   → $<<print $var>>   (literal dollar sign + value, e.g. "$500")
 *   ${var}    → <<print $var>>
 */
export function translateText(text: string): string {
  let result = text;

  // 1. $!{var} — capitalize first letter
  result = result.replace(/\$!\{(\w+)\}/g, (_, v: string) =>
    `<<print $${v}.toString().charAt(0).toUpperCase() + $${v}.toString().slice(1)>>`
  );

  // 2. $${var} — literal dollar sign prefix (e.g. "$$money" → "$500")
  //    Must run before the ${var} pattern so the ${ inside $${var} isn't eaten first.
  result = result.replace(/\$\$\{(\w+)\}/g, (_, v: string) => `$<<print $${v}>>`);

  // 3. ${var} — plain variable interpolation
  result = result.replace(/\$\{(\w+)\}/g, (_, v: string) => `<<print $${v}>>`);

  return result;
}
