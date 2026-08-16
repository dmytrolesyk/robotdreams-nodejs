import fs from 'node:fs';
import z from 'zod';

const Env = z
  .object({
    PORT: z.coerce.number().int().min(1).max(65535),
    PGHOST: z.string().min(1),
    PGPORT: z.coerce.number().int().min(1).max(65535),
    PGUSER: z.string().min(1),
    PGDATABASE: z.string().min(1),
    PG_PASSWORD_FILE: z.string().min(1),
  })
  .transform(({ PG_PASSWORD_FILE, ...rest }) => {
    const PGPASSWORD = fs.readFileSync(PG_PASSWORD_FILE, 'utf8').trim();
    if (!PGPASSWORD) {
      throw new Error(`PG_PASSWORD_FILE (${PG_PASSWORD_FILE}) is empty`);
    }
    return { ...rest, PGPASSWORD };
  });

export default Env.parse(process.env);
