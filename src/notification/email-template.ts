export const getEmailTemplate = (title: string, name: string, body: string, actionText?: string, actionUrl?: string) => `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${title}</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      background-color: #f4f7f9;
      margin: 0;
      padding: 0;
      color: #333;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
    }
    .header {
      background-color: #4f46e5;
      color: #ffffff;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .content {
      padding: 40px;
      line-height: 1.6;
    }
    .content h2 {
      margin-top: 0;
      color: #111827;
      font-size: 20px;
    }
    .content p {
      margin-bottom: 20px;
    }
    .action-button {
      display: inline-block;
      background-color: #4f46e5;
      color: #ffffff !important;
      padding: 12px 24px;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin-top: 10px;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      font-size: 12px;
      color: #6b7280;
    }
    .footer p {
      margin: 5px 0;
    }
    .highlight {
      color: #4f46e5;
      font-weight: bold;
    }
    .details-table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    .details-table td {
      padding: 10px;
      border-bottom: 1px solid #e5e7eb;
    }
    .details-table td:first-child {
      font-weight: 600;
      color: #6b7280;
      width: 40%;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>Lendsqr Wallet</h1>
    </div>
    <div class="content">
      <h2>Hello ${name},</h2>
      <p>${body}</p>
      ${actionUrl ? `<a href="${actionUrl}" class="action-button">${actionText || 'View Details'}</a>` : ''}
    </div>
    <div class="footer">
      <p>&copy; ${new Date().getFullYear()} Lendsqr Wallet. All rights reserved.</p>
      <p>This is an automated notification, please do not reply.</p>
    </div>
  </div>
</body>
</html>
`;
