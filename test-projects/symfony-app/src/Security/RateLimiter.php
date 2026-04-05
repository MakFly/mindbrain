<?php

namespace App\Security;

use Symfony\Component\RateLimiter\RateLimiterFactory;

class RateLimiter
{
    private array $buckets = [];

    public function __construct(
        private RateLimiterFactory $loginLimiter,
        private int $maxTokens = 5,
        private int $refillRate = 1,
    ) {}

    public function consume(string $action, string $identifier): void
    {
        $key = $action . ':' . $identifier;
        $limiter = $this->loginLimiter->create($key);
        $limit = $limiter->consume();

        if (!$limit->isAccepted()) {
            throw new \RuntimeException(
                sprintf('Rate limit exceeded for %s. Retry after %d seconds.', $action, $limit->getRetryAfter()->getTimestamp() - time())
            );
        }
    }

    public function reset(string $action, string $identifier): void
    {
        $key = $action . ':' . $identifier;
        $this->loginLimiter->create($key)->reset();
    }
}
