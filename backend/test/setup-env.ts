// Integration tests must never connect to the shop's SMTP account.
process.env.SMTP_HOST = '';
