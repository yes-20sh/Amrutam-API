import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface JwtPayload {
  sub: string;
  email: string;
  role: string;
  iat?: number;
  exp?: number;
}

export const CurrentUser = createParamDecorator(
  (data: keyof JwtPayload | undefined, context: ExecutionContext) => {
    let req: any;

    if ((context.getType() as string) === 'graphql') {
      const gqlContext = GqlExecutionContext.create(context);
      req = gqlContext.getContext()?.req;
    } else {
      req = context.switchToHttp().getRequest();
    }

    const user = req?.user;

    if (!user) {
      return null;
    }

    return data ? user[data] : user;
  },
);
