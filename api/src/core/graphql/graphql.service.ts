import { Injectable } from '@nestjs/common';
import { GqlOptionsFactory } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ApolloServerPluginLandingPageLocalDefault } from '@apollo/server/plugin/landingPage/default';
import type { Request, Response } from 'express';

@Injectable()
export class GraphQLConfigService implements GqlOptionsFactory<ApolloDriverConfig> {
  createGqlOptions(): ApolloDriverConfig {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    return {
      driver: ApolloDriver,
      autoSchemaFile: true,
      introspection: isDevelopment,
      playground: false,
      graphiql: false,
      context: ({ req, res }: { req: Request; res: Response }) => ({ req, res }),
      plugins: (isDevelopment
        ? [ApolloServerPluginLandingPageLocalDefault()]
        : []
      ) as unknown as ApolloDriverConfig['plugins'],
    };
  }
}

export { GraphQLConfigService as GqlConfigService };