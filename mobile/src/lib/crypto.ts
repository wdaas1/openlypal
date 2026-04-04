import nacl from 'tweetnacl';
import * as naclUtil from 'tweetnacl-util';
import * as SecureStore from 'expo-secure-store';

const PRIVATE_KEY_KEY = 'e2e_private_key';
const PUBLIC_KEY_KEY = 'e2e_public_key';

function toUint8Array(arr: Uint8Array): Uint8Array {
  return arr as unknown as Uint8Array;
}

export async function getOrCreateKeypair(): Promise<{ publicKey: string; secretKey: Uint8Array }> {
  try {
    const stored = SecureStore.getItem(PRIVATE_KEY_KEY);
    const storedPub = SecureStore.getItem(PUBLIC_KEY_KEY);
    if (stored && storedPub) {
      return {
        publicKey: storedPub,
        secretKey: toUint8Array(naclUtil.decodeBase64(stored)),
      };
    }
  } catch {}

  const kp = nacl.box.keyPair();
  const pubBase64 = naclUtil.encodeBase64(toUint8Array(kp.publicKey));
  const secBase64 = naclUtil.encodeBase64(toUint8Array(kp.secretKey));
  try {
    SecureStore.setItem(PRIVATE_KEY_KEY, secBase64);
    SecureStore.setItem(PUBLIC_KEY_KEY, pubBase64);
  } catch {}
  return { publicKey: pubBase64, secretKey: toUint8Array(kp.secretKey) };
}

export function encryptMessage(
  plaintext: string,
  recipientPublicKeyB64: string,
  senderSecretKey: Uint8Array
): string {
  const nonce = nacl.randomBytes(nacl.box.nonceLength);
  const message = toUint8Array(naclUtil.decodeUTF8(plaintext));
  const recipientPK = toUint8Array(naclUtil.decodeBase64(recipientPublicKeyB64));
  const box = nacl.box(message, nonce, recipientPK, senderSecretKey);
  return naclUtil.encodeBase64(toUint8Array(nonce)) + '.' + naclUtil.encodeBase64(toUint8Array(box));
}

export function decryptMessage(
  ciphertext: string,
  senderPublicKeyB64: string,
  ownSecretKey: Uint8Array
): string | null {
  try {
    const [nonceB64, boxB64] = ciphertext.split('.');
    if (!nonceB64 || !boxB64) return null;
    const nonce = toUint8Array(naclUtil.decodeBase64(nonceB64));
    const box = toUint8Array(naclUtil.decodeBase64(boxB64));
    const senderPK = toUint8Array(naclUtil.decodeBase64(senderPublicKeyB64));
    const opened = nacl.box.open(box, nonce, senderPK, ownSecretKey);
    if (!opened) return null;
    return naclUtil.encodeUTF8(toUint8Array(opened));
  } catch {
    return null;
  }
}
