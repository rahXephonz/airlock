/**
 * The four deployed origins. Kept in one place because both the console and the
 * fixtures need them: the console to discover tools, the fixtures to declare who
 * they are willing to expose those tools to.
 */
export const ORIGINS = {
  console: 'https://airlock-console.netlify.app',
  vault: 'https://airlock-vault.netlify.app',
  dispatch: 'https://airlock-dispatch.netlify.app',
  bazaar: 'https://airlock-bazaar.netlify.app',
} as const;

export type OriginName = keyof typeof ORIGINS;

/**
 * How far the console is willing to trust an origin before any tool is called.
 *
 * This is the console's own judgement, not something the partner origin asserts.
 * Nothing a foreign origin sends us — `readOnlyHint` above all — is allowed to
 * move an origin up this scale. See `TRUST` below.
 */
export type TrustLevel = 'self' | 'trusted' | 'semi-trusted';

export interface OriginProfile {
  readonly name: OriginName;
  readonly url: string;
  readonly trust: TrustLevel;
  /** Shown in the console so a user can see why an origin is classified as it is. */
  readonly rationale: string;
  /**
   * True when this origin's tool output can contain text an attacker influences.
   * Any value that flows out of such a tool is tainted for the rest of the session.
   */
  readonly emitsUntrustedContent: boolean;
}

export const TRUST: Record<OriginName, OriginProfile> = {
  console: {
    name: 'console',
    url: ORIGINS.console,
    trust: 'self',
    rationale: 'Airlock itself. Same origin as the policy engine.',
    emitsUntrustedContent: false,
  },
  vault: {
    name: 'vault',
    url: ORIGINS.vault,
    trust: 'trusted',
    rationale: 'User-owned record store. Read-heavy, holds the sensitive data.',
    emitsUntrustedContent: false,
  },
  dispatch: {
    name: 'dispatch',
    url: ORIGINS.dispatch,
    trust: 'trusted',
    rationale: 'User-owned outbound channel. Trusted, but write-capable, so every call is a real side effect.',
    emitsUntrustedContent: false,
  },
  bazaar: {
    name: 'bazaar',
    url: ORIGINS.bazaar,
    trust: 'semi-trusted',
    rationale: 'Third-party marketplace. Listing text is supplied by sellers, so its tool output is attacker-controlled.',
    emitsUntrustedContent: true,
  },
};

export const originNameFor = (url: string | undefined): OriginName | undefined =>
  (Object.keys(TRUST) as OriginName[]).find((n) => TRUST[n].url === url);
