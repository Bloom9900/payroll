import { create } from 'xmlbuilder2'
import { validateIBAN } from 'ibantools'

export type SepaPayment = {
  endToEndId: string
  name: string
  iban: string
  bic?: string
  amount: number
  remittance: string
}

export function buildPain001 (debtor: { name: string, iban: string, bic?: string }, payments: SepaPayment[]) {
  if (!validateIBAN(debtor.iban)) throw new Error('Invalid company IBAN')
  payments.forEach(p => { if (!validateIBAN(p.iban)) throw new Error('Invalid employee IBAN for ' + p.name) })
  const now = new Date().toISOString()
  const doc = create({ version: '1.0', encoding: 'UTF-8' })
    .ele('Document', { xmlns: 'urn:iso:std:iso:20022:tech:xsd:pain.001.001.03' })
      .ele('CstmrCdtTrfInitn')
        .ele('GrpHdr')
          .ele('MsgId').txt('MSG-' + now).up()
          .ele('CreDtTm').txt(now).up()
          .ele('NbOfTxs').txt(String(payments.length)).up()
          .ele('CtrlSum').txt(payments.reduce((a, b) => a + b.amount, 0).toFixed(2)).up()
          .ele('InitgPty').ele('Nm').txt(debtor.name).up().up()
        .up()
        .ele('PmtInf')
          .ele('PmtInfId').txt('PMT-' + now).up()
          .ele('PmtMtd').txt('TRF').up()
          .ele('ReqdExctnDt').txt(now.substring(0, 10)).up()
          .ele('Dbtr').ele('Nm').txt(debtor.name).up().up()
          .ele('DbtrAcct').ele('Id').ele('IBAN').txt(debtor.iban).up().up().up()
          .ele('DbtrAgt').ele('FinInstnId').ele('BIC').txt(debtor.bic ?? '').up().up().up()
          .ele('ChrgBr').txt('SLEV').up()
          .import(payments.map(p => ({
            CdtTrfTxInf: {
              PmtId: { EndToEndId: p.endToEndId },
              Amt: { InstdAmt: { '@Ccy': 'EUR', '#': p.amount.toFixed(2) } },
              CdtrAgt: { FinInstnId: { BIC: p.bic ?? '' } },
              Cdtr: { Nm: p.name },
              CdtrAcct: { Id: { IBAN: p.iban } },
              RmtInf: { Ustrd: p.remittance }
            }
          })) as any)
        .up()
      .up()
    .up()
  return doc.end({ prettyPrint: true })
}
