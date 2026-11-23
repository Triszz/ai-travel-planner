import { describe, expect, it } from 'vitest';
import { generateKeyPair, SignJWT } from 'jose';
import { JwtAccessTokenVerifier } from './jwt-access-token.verifier.js';
import { InvalidAccessTokenError } from './invalid-access-token.error.js';

describe('JwtAccessTokenVerifier', () => {
  it('JWT-001: accepts a valid RS256 access token', async () => {
    // Arrange: generate a fresh RSA key pair for this test.
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';
    const userId = 'user_123';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject(userId)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).resolves.toEqual({
      userId,
    });
  });

  it('JWT-002: rejects a token signed with a different private key', async () => {
    // Arrange: verifier trusts the first key pair only.
    const trustedKeys = await generateKeyPair('RS256');
    const attackerKeys = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(attackerKeys.privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey: trustedKeys.publicKey,
      issuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-003: rejects an expired access token', async () => {
    // Arrange
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const expiredAt = Math.floor(Date.now() / 1000) - 60;

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime(expiredAt)
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-004: rejects a token with an unexpected issuer', async () => {
    // Arrange
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const expectedIssuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer('urn:untrusted:issuer')
      .setAudience(audience)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer: expectedIssuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-005: rejects a token with an unexpected audience', async () => {
    // Arrange
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const expectedAudience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience('another-api')
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience: expectedAudience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-006: rejects a token signed with an unsupported algorithm', async () => {
    // Arrange: create a valid PS256 token and matching key pair.
    const { publicKey, privateKey } = await generateKeyPair('PS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'PS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('user_123')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-007: rejects a token without a subject claim', async () => {
    // Arrange
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    // Act & Assert
    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-008: rejects a token without an expiration claim', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('user_123')
      .setIssuedAt()
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });

  it('JWT-009: rejects a token with a blank subject', async () => {
    const { publicKey, privateKey } = await generateKeyPair('RS256');

    const issuer = 'urn:ai-travel-planner:auth';
    const audience = 'ai-travel-planner-api';

    const token = await new SignJWT({})
      .setProtectedHeader({ alg: 'RS256' })
      .setIssuer(issuer)
      .setAudience(audience)
      .setSubject('   ')
      .setIssuedAt()
      .setExpirationTime('15m')
      .sign(privateKey);

    const verifier = new JwtAccessTokenVerifier({
      publicKey,
      issuer,
      audience,
    });

    await expect(verifier.verify(token)).rejects.toBeInstanceOf(
      InvalidAccessTokenError,
    );
  });
});
