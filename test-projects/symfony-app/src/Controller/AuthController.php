<?php

namespace App\Controller;

use App\Security\JwtAuthenticator;
use App\Security\RateLimiter;
use Symfony\Bundle\FrameworkBundle\Controller\AbstractController;
use Symfony\Component\HttpFoundation\JsonResponse;
use Symfony\Component\HttpFoundation\Request;
use Symfony\Component\Routing\Attribute\Route;

#[Route('/api/auth')]
class AuthController extends AbstractController
{
    public function __construct(
        private JwtAuthenticator $jwt,
        private RateLimiter $limiter,
    ) {}

    #[Route('/login', name: 'auth_login', methods: ['POST'])]
    public function login(Request $request): JsonResponse
    {
        $this->limiter->consume('login', $request->getClientIp());

        $credentials = $request->toArray();
        $token = $this->jwt->authenticate($credentials['email'], $credentials['password']);

        return $this->json(['token' => $token]);
    }

    #[Route('/logout', name: 'auth_logout', methods: ['POST'])]
    public function logout(): JsonResponse
    {
        return $this->json(['message' => 'Logged out']);
    }

    #[Route('/register', name: 'auth_register', methods: ['POST'])]
    public function register(Request $request): JsonResponse
    {
        $data = $request->toArray();

        return $this->json(['user' => $data['email']], 201);
    }
}
