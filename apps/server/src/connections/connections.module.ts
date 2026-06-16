/**
|--------------------------------------------------
| Npm imports
|--------------------------------------------------
*/
import { Module } from '@nestjs/common';

/**
|--------------------------------------------------
| Custom imports
|--------------------------------------------------
*/
import { ConnectionsController } from './connections.controller.js';

/**
|--------------------------------------------------
| Source-control connections module
|--------------------------------------------------
*/
@Module({
	controllers: [ConnectionsController],
})
export class ConnectionsModule {}
