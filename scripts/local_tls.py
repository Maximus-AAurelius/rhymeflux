"""Per-computer certificate authority for optional private iPhone access.

Only the public certificate is downloadable. Private keys stay outside the web root.
Trust is installed by the owner on the phone, never changed automatically.
"""
import ipaddress
import plistlib
import socket
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from cryptography import x509
from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from cryptography.x509.oid import NameOID, ExtendedKeyUsageOID


def prepare(data):
    folder = Path(data) / "tls"
    folder.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc)
    root_key_path, root_cert_path = folder / 'ca-key.pem', folder / 'ca.pem'
    if root_key_path.exists() and root_cert_path.exists():
        root_key = serialization.load_pem_private_key(root_key_path.read_bytes(), password=None)
        ca = x509.load_pem_x509_certificate(root_cert_path.read_bytes())
    else:
        root_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
        name = x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'ScrewShop Private Local CA')])
        ca = (x509.CertificateBuilder().subject_name(name).issuer_name(name).public_key(root_key.public_key())
              .serial_number(x509.random_serial_number()).not_valid_before(stamp - timedelta(days=1))
              .not_valid_after(stamp + timedelta(days=3650)).add_extension(x509.BasicConstraints(ca=True, path_length=0), critical=True)
              .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=False, data_encipherment=False, key_agreement=False, key_cert_sign=True, crl_sign=True, encipher_only=False, decipher_only=False), critical=True)
              .sign(root_key, hashes.SHA256()))
        root_key_path.write_bytes(root_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
        root_cert_path.write_bytes(ca.public_bytes(serialization.Encoding.PEM))
    hosts = sorted({'localhost', socket.gethostname(), '127.0.0.1', *socket.gethostbyname_ex(socket.gethostname())[2]})
    sans = []
    for host in hosts:
        try:
            sans.append(x509.IPAddress(ipaddress.ip_address(host)))
        except ValueError:
            sans.append(x509.DNSName(host))
    key = rsa.generate_private_key(public_exponent=65537, key_size=2048)
    cert = (x509.CertificateBuilder().subject_name(x509.Name([x509.NameAttribute(NameOID.COMMON_NAME, 'ScrewShop')]))
            .issuer_name(ca.subject).public_key(key.public_key()).serial_number(x509.random_serial_number())
            .not_valid_before(stamp - timedelta(days=1)).not_valid_after(stamp + timedelta(days=365))
            .add_extension(x509.BasicConstraints(ca=False, path_length=None), critical=True)
            .add_extension(x509.SubjectAlternativeName(sans), critical=False)
            .add_extension(x509.ExtendedKeyUsage([ExtendedKeyUsageOID.SERVER_AUTH]), critical=False)
            .add_extension(x509.KeyUsage(digital_signature=True, content_commitment=False, key_encipherment=True, data_encipherment=False, key_agreement=False, key_cert_sign=False, crl_sign=False, encipher_only=False, decipher_only=False), critical=True)
            .sign(root_key, hashes.SHA256()))
    (folder / 'server-key.pem').write_bytes(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8, serialization.NoEncryption()))
    (folder / 'server.pem').write_bytes(cert.public_bytes(serialization.Encoding.PEM))
    profile = {'PayloadType': 'Configuration', 'PayloadVersion': 1, 'PayloadIdentifier': 'local.screwshop.certificate', 'PayloadUUID': str(uuid.uuid4()), 'PayloadDisplayName': 'ScrewShop Local Connection', 'PayloadDescription': 'Trust the private ScrewShop server on your own computer. This installs a certificate only; it does not enroll or manage your phone.', 'PayloadContent': [{'PayloadType': 'com.apple.security.root', 'PayloadVersion': 1, 'PayloadIdentifier': 'local.screwshop.certificate.root', 'PayloadUUID': str(uuid.uuid4()), 'PayloadDisplayName': 'ScrewShop Private Local CA', 'PayloadContent': ca.public_bytes(serialization.Encoding.DER)}]}
    (folder / 'ScrewShop.mobileconfig').write_bytes(plistlib.dumps(profile))
    (folder / 'fingerprint.txt').write_text(ca.fingerprint(hashes.SHA256()).hex(':'), encoding='utf-8')
    return folder
