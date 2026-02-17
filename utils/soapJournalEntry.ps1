# SAP Journal Entry SOAP API - Based on client's working template
# Update the $url and credentials once endpoint details are shared by mvnsmallik@SAP

$body = @"
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                  xmlns:sfin="http://sap.com/xi/SAPSCORE/SFIN">
   <soapenv:Header/>
   <soapenv:Body>
      <sfin:JournalEntryBulkCreateRequest>
         <MessageHeader>
            <ID>BATCH-VALUE-DATE</ID>
            <UUID>bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb</UUID>
            <CreationDateTime>2026-02-16T22:00:00Z</CreationDateTime>
         </MessageHeader>
         <JournalEntryCreateRequest>
            <MessageHeader>
               <ID>REQ-VALUE-DATE</ID>
               <UUID>cccccccc-cccc-cccc-cccc-cccccccccccc</UUID>
               <CreationDateTime>2026-02-16T22:00:00Z</CreationDateTime>
            </MessageHeader>
            <JournalEntry>
               <OriginalReferenceDocumentType>BKPFF</OriginalReferenceDocumentType>
               <BusinessTransactionType>RFBU</BusinessTransactionType>
               <AccountingDocumentType>SA</AccountingDocumentType>
               <CreatedByUser>DEMO</CreatedByUser>
               <CompanyCode>ACS</CompanyCode>
               <DocumentDate>2026-02-16</DocumentDate>
               <PostingDate>2026-02-16</PostingDate>
               <DocumentHeaderText>VALUE DATE</DocumentHeaderText>

               <!-- DEBIT ITEM: Bank account - ValueDate is required -->
               <Item>
                  <GLAccount listID="GL">113002</GLAccount>
                  <AmountInTransactionCurrency currencyCode="USD">100.00</AmountInTransactionCurrency>
                  <DebitCreditCode>S</DebitCreditCode>
                  <DocumentItemText>Bank</DocumentItemText>
                  <ValueDate>2026-02-16</ValueDate>
               </Item>

               <!-- CREDIT ITEM: Equity account - ValueDate not required -->
               <Item>
                  <GLAccount listID="GL">217000</GLAccount>
                  <AmountInTransactionCurrency currencyCode="USD">-100.00</AmountInTransactionCurrency>
                  <DebitCreditCode>H</DebitCreditCode>
                  <DocumentItemText>Reserves</DocumentItemText>
               </Item>
            </JournalEntry>
         </JournalEntryCreateRequest>
      </sfin:JournalEntryBulkCreateRequest>
   </soapenv:Body>
</soapenv:Envelope>
"@

# UPDATE THESE once mvnsmallik@SAP shares endpoint details
$username = "basis"
$password = "Welcome2025"
$securePass = ConvertTo-SecureString $password -AsPlainText -Force
$cred = New-Object System.Management.Automation.PSCredential($username, $securePass)

# UPDATE THIS URL once endpoint is shared
$url = "https://kps4hana:44304/sap/bc/srt/xip/sap/journalentrybulkcreaterequestc/001/journal_entry_bulk_create_req/journal_entry_bulk_create_req"

Write-Host "Sending SOAP request to: $url"
$response = Invoke-WebRequest -Uri $url -Method POST -Body $body -ContentType "text/xml" -Credential $cred -SkipCertificateCheck
Write-Host "Status: $($response.StatusCode)"
Write-Host "Response: $($response.Content)"
