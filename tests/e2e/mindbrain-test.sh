#!/bin/bash
set -e

MB="bun run apps/cli/src/index.ts"

echo "=== 1. Init project ==="
$MB init symfony-test --path test-projects/symfony-app

echo "=== 2. Save architecture notes ==="
echo "Symfony 7 with security bundle. Auth via JWT tokens. Rate limiting on API endpoints." | \
  $MB save "Project Architecture" -t project --tags "architecture,symfony"

echo "Auth handled by SecurityBundle + custom JWT authenticator in src/Security/." | \
  $MB save "Auth System" -t codebase --tags "auth,security"

echo "Token bucket rate limiter in src/Security/RateLimiter.php. Config in config/packages/rate_limiter.yaml. See [[Auth System]]." | \
  $MB save "Rate Limiting" -t codebase --tags "performance,security"

echo "User entity with email, roles, password. Managed by Doctrine ORM. See [[Auth System]] and [[Rate Limiting]]." | \
  $MB save "User Entity" -t codebase --tags "entity,doctrine"

echo "Never return raw exceptions to API clients. Always use structured error responses." | \
  $MB save "Error Handling Rule" -t feedback --tags "api,errors"

echo "Bug tracker in Linear project SYMF. Design docs in Notion /symfony-app." | \
  $MB save "External Resources" -t reference --tags "linear,notion"

echo "=== 3. Search ==="
$MB search "auth"

echo "=== 4. Context ==="
$MB context -f src/Security/RateLimiter.php src/Controller/AuthController.php -t "fix rate limiting on login endpoint"

echo "=== 5. Graph ==="
$MB graph

echo "=== DONE ==="
echo "All Mindbrain E2E tests passed!"
