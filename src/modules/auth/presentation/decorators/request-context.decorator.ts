import { createParamDecorator, ExecutionContext } from '@nestjs/common'
import { AuthContext } from '../../domain/auth-context'

type RequestWithContext = {
  authContext?: AuthContext
}

export const RequestContext = createParamDecorator((_data: unknown, context: ExecutionContext) => {
  const request = context.switchToHttp().getRequest<RequestWithContext>()
  return request.authContext
})
