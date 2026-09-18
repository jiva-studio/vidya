import { AuthService } from '@/ui/auth'
import { useConfig } from '@/shared'

export function useAuthService() {
  const config = useConfig()
  return new AuthService(config.baseUrl.value)
}