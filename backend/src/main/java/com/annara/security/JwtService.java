package com.annara.security;

import com.annara.entity.AppUser;
import io.jsonwebtoken.Claims;
import io.jsonwebtoken.Jwts;
import io.jsonwebtoken.security.Keys;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;
import java.nio.charset.StandardCharsets;

@Component
public class JwtService {
    private final javax.crypto.SecretKey key;
    private final long expiryHours;

    public JwtService(@Value("${app.jwt.secret}") String secret, @Value("${app.jwt.expiry-hours:12}") long expiryHours) {
        if (secret.length() < 32) throw new IllegalStateException("JWT secret must be at least 32 characters");
        this.key = Keys.hmacShaKeyFor(secret.getBytes(StandardCharsets.UTF_8));
        this.expiryHours = expiryHours;
    }

    public String issue(AppUser u) {
        return Jwts.builder().subject(u.id).claim("role", u.role.name())
                .claim("name", u.fullName).issuedAt(new java.util.Date())
                .expiration(new java.util.Date(System.currentTimeMillis() + expiryHours * 3600000))
                .signWith(key).compact();
    }

    public Claims parse(String token) {
        return Jwts.parser().verifyWith(key).build().parseSignedClaims(token).getPayload();
    }
}
