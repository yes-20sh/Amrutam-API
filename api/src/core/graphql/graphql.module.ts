import { Module } from '@nestjs/common';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { GraphQLConfigService } from './graphql.service';

@Module({
  imports: [
    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useClass: GraphQLConfigService,
    }),
  ],
  providers: [GraphQLConfigService],
  exports: [GraphQLModule],
})
export class GraphqlModule {}

export { GraphqlModule as AppGraphQLModule };
