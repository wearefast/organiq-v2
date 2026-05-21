import { AhrefsService } from './src/features/integrations/ahrefs/ahrefs.service';
import { ConfigService } from '@nestjs/config';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../.env') });

async function run() {
  const configService = new ConfigService(process.env);
  const ahrefsService = new (AhrefsService as any)(configService);

  try {
    const result: any = await ahrefsService.getSerpOverview('mashreq bank global hq', 'AE');
    
    const positions = result?.positions || [];
    const first = positions[0] || {};
    
    const summary = {
      positionsCount: positions.length,
      firstPosition: first.position,
      firstUrl: first.url,
      firstTypes: first.type
    };
    
    console.log(JSON.stringify(summary, null, 2));
  } catch (error) {
    console.error(error.message);
    process.exit(1);
  }
}

run();
