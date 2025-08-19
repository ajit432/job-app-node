module.exports = {
  welcome: { 
    subject: (data) => `Welcome to the Team, ${data.name}!`,
    templateFile: 'welcome.html',
  },
  otpRequest: {
    subject: (isResend) => (isResend ? 'Resent: Your OTP Code For Login ' : 'Your OTP Code For Login '),
    templateFile: 'otpRequest.html',
  },
  profileUpdate: {
    subject: 'Your Profile Has Been Updated',
    templateFile: 'profileUpdate.html',
  },
  statusReport: {
    subject: (data) => `Status Report of ${data.reportDate} - ${data.projectName}`,
    templateFile: 'statusReport.html'
  },
};