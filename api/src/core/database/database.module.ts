import { Global, Logger, Module, OnModuleInit } from '@nestjs/common';
import { TypeOrmModule, InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { DatabaseConfigService } from './database.service';
import { SCHEMAS } from '../../schemas/schemas';


@Global()
@Module({
    imports: [
        TypeOrmModule.forRootAsync({
            imports: [],
            useClass: DatabaseConfigService,
        }),
        TypeOrmModule.forFeature(Object.values(SCHEMAS)),
    ],
    providers: [DatabaseConfigService],
    exports: [TypeOrmModule],
})
export class DatabaseModule implements OnModuleInit {
    private readonly logger = new Logger(DatabaseModule.name);

    constructor(@InjectDataSource() private readonly dataSource: DataSource) { }

    async onModuleInit(): Promise<void> {
        if (!this.dataSource.isInitialized) {
            try {
                await this.dataSource.initialize();
            } catch (error) {
                this.logger.error(
                    'Failed to connect PostgreSQL database.',
                    error,
                );
                return;
            }
        }

        if (this.dataSource.isInitialized) {
            this.logger.log(
                'Successfully connected PostgreSQL database.',
            );
        } else {
            this.logger.error('Failed to connect PostgreSQL database.');
        }
    }
}
