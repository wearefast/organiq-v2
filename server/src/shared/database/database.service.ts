import { Injectable } from '@nestjs/common';
import { db, Database } from '../../db';

@Injectable()
export class DatabaseService {
  readonly db: Database = db;
}
