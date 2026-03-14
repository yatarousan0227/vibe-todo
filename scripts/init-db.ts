import { query, schemaStatements } from "../src/lib/intake/db";
import { refinementSchemaStatements } from "../src/lib/refinement/db";
import { planningSchemaStatements } from "../src/lib/planning/db";

async function main() {
  const allSchemaStatements = [
    ...schemaStatements,
    ...refinementSchemaStatements,
    ...planningSchemaStatements,
  ];

  for (const statement of allSchemaStatements) {
    await query(statement);
  }

  process.stdout.write("Database schema initialized.\n");
}

main().catch((error) => {
  process.stderr.write(`${String(error)}\n`);
  process.exit(1);
});
