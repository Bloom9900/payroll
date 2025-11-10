import { buildSepaPayments } from './payroll.js'
import { getCompanyProfile } from './employees.js'

function xmlEscape (value) {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function formatAmount (value) {
  return Number(value).toFixed(2)
}

export function buildSepaXml (month, options = {}) {
  const payments = buildSepaPayments(month, options)
  const company = { ...getCompanyProfile(), ...(options.company ?? {}) }
  if (!company.iban) throw new Error('Company IBAN missing')
  if (!company.name) throw new Error('Company name missing')

  const now = new Date().toISOString()
  const executionDate = (options.paymentDate ?? now.slice(0, 10))
  const ctrlSum = formatAmount(payments.reduce((sum, p) => sum + Number(p.amount), 0))
  const paymentBlocks = payments.map(p => `
        <CdtTrfTxInf>
          <PmtId>
            <EndToEndId>${xmlEscape(p.endToEndId)}</EndToEndId>
          </PmtId>
          <Amt>
            <InstdAmt Ccy="EUR">${formatAmount(p.amount)}</InstdAmt>
          </Amt>
          <CdtrAgt>
            <FinInstnId><BIC>${xmlEscape(p.bic || '')}</BIC></FinInstnId>
          </CdtrAgt>
          <Cdtr>
            <Nm>${xmlEscape(p.name)}</Nm>
          </Cdtr>
          <CdtrAcct>
            <Id><IBAN>${xmlEscape(p.iban)}</IBAN></Id>
          </CdtrAcct>
          <RmtInf>
            <Ustrd>${xmlEscape(p.remittance)}</Ustrd>
          </RmtInf>
        </CdtTrfTxInf>`).join('')

  return `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:pain.001.001.03">
  <CstmrCdtTrfInitn>
    <GrpHdr>
      <MsgId>MSG-${xmlEscape(now)}</MsgId>
      <CreDtTm>${xmlEscape(now)}</CreDtTm>
      <NbOfTxs>${payments.length}</NbOfTxs>
      <CtrlSum>${ctrlSum}</CtrlSum>
      <InitgPty><Nm>${xmlEscape(company.name)}</Nm></InitgPty>
    </GrpHdr>
    <PmtInf>
      <PmtInfId>PMT-${xmlEscape(now)}</PmtInfId>
      <PmtMtd>TRF</PmtMtd>
      <ReqdExctnDt>${xmlEscape(executionDate)}</ReqdExctnDt>
      <Dbtr><Nm>${xmlEscape(company.name)}</Nm></Dbtr>
      <DbtrAcct><Id><IBAN>${xmlEscape(company.iban)}</IBAN></Id></DbtrAcct>
      <DbtrAgt><FinInstnId><BIC>${xmlEscape(company.bic || '')}</BIC></FinInstnId></DbtrAgt>
      <ChrgBr>SLEV</ChrgBr>${paymentBlocks}
    </PmtInf>
  </CstmrCdtTrfInitn>
</Document>`
}
