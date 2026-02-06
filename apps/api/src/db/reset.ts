import { sql } from 'drizzle-orm';
import { db } from './index';

async function reset() {
  console.log('🗑️  Resetting database...');
  
  try {
    await db.execute(sql`TRUNCATE TABLE nodes CASCADE`);
    console.log('✅ Database reset successfully!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Failed to reset database:', error);
    process.exit(1);
  }
}

reset();

