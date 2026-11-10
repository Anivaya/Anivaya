/** Compatibility for the repository's deliberately small SQLite SQL dialect.
 * Values remain bound parameters; this translator only receives application SQL.
 * Local development keeps SQLite, while hosted installations use PostgreSQL. */
export function postgresSql(source: string): string {
  const info = source.match(/^\s*PRAGMA table_info\((\w+)\)\s*;?$/i);
  if (info) return `SELECT column_name AS name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='${info[1]}' ORDER BY ordinal_position`;
  source = source.replace(/PRAGMA foreign_keys\s*=\s*ON\s*;/gi, "");
  source = source.replace(/CREATE TRIGGER IF NOT EXISTS (\w+) AFTER (INSERT|UPDATE) ON (\w+) BEGIN\s*([\s\S]*?)\s*END;/gi,
    (_, name, event, table, body) => `CREATE OR REPLACE FUNCTION ${name}_fn() RETURNS trigger LANGUAGE plpgsql AS $trigger$ BEGIN ${body} RETURN NEW; END $trigger$; CREATE OR REPLACE TRIGGER ${name} AFTER ${event} ON ${table} FOR EACH ROW EXECUTE FUNCTION ${name}_fn();`);
  source = source.replace(/strftime\('[^']*','now'(?:,'([^']*)')?\)/gi,
    (_, offset) => `to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')${offset ? ` + INTERVAL '${offset}'` : ''},'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`);
  source = source.replace(/\b(date|datetime)\('now'(?:,'([^']*)')?\)/gi,
    (_, kind, offset) => `to_char((CURRENT_TIMESTAMP AT TIME ZONE 'UTC')${offset ? ` + INTERVAL '${offset}'` : ''},'${kind.toLowerCase() === 'date' ? 'YYYY-MM-DD' : 'YYYY-MM-DD HH24:MI:SS'}')`);
  // Protect literal contents (including semicolons and question marks) and comments.
  const tokens = source.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|--[^\n]*|\/\*[\s\S]*?\*\/|[A-Za-z_][\w]*|\s+|./gs) ?? [];
  let parameter = 0;
  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i];
    if (token.startsWith('--') || token.startsWith('/*')) { tokens[i] = ' '; continue; }
    if (token === '?') tokens[i] = `$${++parameter}`;
    else if (/^INTEGER$/i.test(token)) tokens[i] = 'BIGINT';
    else if (/^BLOB$/i.test(token)) tokens[i] = 'BYTEA';
    else if (/^rowid$/i.test(token)) tokens[i] = '_rowid';
    else if (/^LIKE$/i.test(token)) tokens[i] = 'ILIKE';
    else if (/^sqlite_master$/i.test(token)) tokens[i] = "(SELECT tablename AS name,'table' AS type FROM pg_tables WHERE schemaname=current_schema()) AS sqlite_master";
    else if (/^AS$/i.test(token)) {
      let next = i + 1;
      while (/^\s+$/.test(tokens[next] || '')) next++;
      const alias = tokens[next];
      if (alias && (/^[a-z]\w*[A-Z]\w*$/.test(alias) || /^'\w+'$/.test(alias))) tokens[next] = '"' + alias.replaceAll("'", '') + '"';
    }
  }
  let sql = tokens.join('').replace(/\s+COLLATE\s+NOCASE\b/gi, '');
  // Append a stable insertion sequence, also used to preserve legacy ordering.
  // PostgreSQL supplies the trailing default for positional INSERTs.
  sql = sql.replace(/(CREATE TABLE(?: IF NOT EXISTS)?\s+\w+\s*\()/gi, '$1_rowid_placeholder,');
  if (sql.includes('_rowid_placeholder,')) {
    // Locate the matching table parenthesis, respecting quoted SQL strings.
    const parts = sql.match(/'(?:''|[^'])*'|"(?:""|[^"])*"|_rowid_placeholder,|./gs)!;
    let depth = 0, tableDepth = -1;
    for (let i = 0; i < parts.length; i++) {
      if (parts[i] === '(') depth++;
      if (parts[i] === '_rowid_placeholder,') { parts[i] = ''; tableDepth = depth; }
      if (parts[i] === ')') {
        if (depth === tableDepth) { parts[i] = ', _rowid BIGINT GENERATED ALWAYS AS IDENTITY UNIQUE)'; tableDepth = -1; }
        depth--;
      }
    }
    sql = parts.join('');
  }
  if (/^\s*INSERT OR IGNORE\b/i.test(sql))
    sql = sql.replace(/INSERT OR IGNORE/i, 'INSERT').replace(/;?\s*$/, ' ON CONFLICT DO NOTHING');
  // PostgreSQL requires the target to disambiguate it from excluded.count.
  sql = sql.replace(/SET count=count\+1/g, 'SET count=request_limits.count+1');
  return sql;
}
