import 'dotenv/config';
export const config = {
    port: parseInt(process.env.PORT ?? '3000', 10),
    company: { iban: process.env.COMPANY_IBAN ?? '', bic: process.env.COMPANY_BIC ?? '', name: process.env.COMPANY_NAME ?? 'Company BV' },
    locale: { currency: process.env.DEFAULT_CURRENCY ?? 'EUR' }
};
