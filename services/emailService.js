const sgMail = require('@sendgrid/mail');
sgMail.setApiKey(process.env.SENDGRID_API_KEY);

const EMAIL_FROM = process.env.EMAIL_FROM || 'connect@auwiretech.com';

/**
 * Send subscription/registration confirmation email
 * @param {string} to - recipient email
 * @param {string} coach_name - coach or user name
 * @param {string} confirm_link - link for confirmation (if needed)
 */
async function sendSubscriptionConfirmation({ to, coach_name, confirm_link }) {
  const msg = {
    to,
    from: EMAIL_FROM,
    templateId: 'd-7a72a2ef1e3345d38ab441aa26e5c638', // your template
    dynamic_template_data: {
      coach_name,
      confirm_link
    }
  };
  await sgMail.send(msg);
}

/**
 * Send quota exceeded notification email
 * @param {string} to - recipient email
 * @param {string} coach_name - coach or user name
 * @param {number} quota_used - number of analyses used
 * @param {number} quota_limit - monthly limit
 */
async function sendQuotaExceededNotification({ to, coach_name, quota_used, quota_limit }) {
  const msg = {
    to,
    from: EMAIL_FROM,
    templateId: 'd-7a72a2ef1e3345d38ab441aa26e5c638', // same template or another
    dynamic_template_data: {
      coach_name,
      quota_used,
      quota_limit
    }
  };
  await sgMail.send(msg);
}

module.exports = {
  sendSubscriptionConfirmation,
  sendQuotaExceededNotification
};
