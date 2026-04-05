<?php

namespace App\Security;

use App\Repository\UserRepository;
use Symfony\Component\Security\Http\Authenticator\AbstractAuthenticator;
use Symfony\Component\Security\Http\Authenticator\Passport\Passport;

class JwtAuthenticator extends AbstractAuthenticator
{
    private string $secret;

    public function __construct(
        private UserRepository $userRepository,
        string $jwtSecret = 'change-me',
    ) {
        $this->secret = $jwtSecret;
    }

    public function authenticate(string $email, string $password): string
    {
        $user = $this->userRepository->findByEmail($email);
        if (!$user || !password_verify($password, $user->getPassword())) {
            throw new \RuntimeException('Invalid credentials');
        }

        $payload = json_encode([
            'sub' => $user->getId(),
            'email' => $user->getEmail(),
            'roles' => $user->getRoles(),
            'exp' => time() + 3600,
        ]);

        return base64_encode(hash_hmac('sha256', $payload, $this->secret) . '.' . $payload);
    }

    public function supports($request): ?bool
    {
        return $request->headers->has('Authorization');
    }

    public function createPassport($request): Passport
    {
        throw new \LogicException('Not implemented in test stub.');
    }
}
