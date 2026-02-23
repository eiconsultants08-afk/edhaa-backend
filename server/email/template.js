export const generateEmailBody = (body) => {
    const { mailTitle = "Thank You!", customerName = "User", orderDetails = [], subTitle="", footerText="Thank you" } = body;
    const logoImage = 'https://www.weathercastsolutions.com/images/WeatherCast.png';

    return `
    <!DOCTYPE html>
    <html>
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${mailTitle}</title>
    </head>
    <body style="font-family: Arial, sans-serif; margin: 0; padding: 0; background-color: whitesmoke; text-align: center;">
        
        <div style="width: 600px; margin: 20px auto; background-color: white; padding: 20px; border-radius: 10px;">

            <!-- Header -->
            <div style="background-color: rgb(39, 86, 255); color: #fff; padding: 20px; border-top-left-radius: 10px; border-top-right-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 15px;">
                <div style="background-color: white; border-radius: 50%; padding: 10px;">
                    <img src="${logoImage}" alt="WeatherCast Logo" style="max-width: 70px; display: block;">
                </div>
                <h1 style="font-size: 29px; margin: 0; padding: 25px 0px 0px 21px;">WeatherCast Solutions Pvt. Ltd.</h1>
            </div>

            <!-- Content -->
            <div style="background-color:rgb(255, 255, 255); padding: 20px; text-align: left;">
                <h2 style="font-size: 26px; color: black; text-align: center;">${mailTitle}</h2>
                <p style="font-size: 18px; color: black;">Dear ${customerName},</p>
                <p style="font-size: 18px; color: black; margin:7px 0px">${subTitle}</p>

                <!-- Table -->
                <table style="width: 100%; border-collapse: collapse; margin-top: 20px; background-color: #f9f9f9; box-shadow: 2px 2px 5px rgba(0, 0, 0, 0.1);">
                    ${orderDetails.length > 0 ? orderDetails.map(detail => `
                        <tr>
                            <td style="font-size: 18px; font-weight: bold; padding: 8px; border: 1px solid #ddd; color: #555;">${detail.label}</td>
                            <td style="font-size: 18px; padding: 8px; border: 1px solid #ddd;">:</td>
                            <td style="font-size: 18px; padding: 8px; border: 1px solid #ddd;">${detail.value}</td>
                        </tr>
                    `).join('') : `<tr><td colspan="3" style="padding: 8px; text-align: center;">No order details available.</td></tr>`}
                </table>

                <p style="color: black; margin-top: 20px; font-size: 16px;">${footerText}</p>
            </div>

            <!-- Footer -->
            <div style="background-color: rgb(246, 137, 2); padding: 10px; border-bottom-left-radius: 10px; border-bottom-right-radius: 10px; display: flex; align-items: center; justify-content: space-between;">
                <a href="https://www.linkedin.com/company/weathercast-pvt-ltd/posts/?feedView=all" target="_blank" style="font-weight: 600; color: white; text-decoration: none; font-size: 14px; padding: 0 10px;">Linkedin</a>
                <a href="https://x.com/WeatherCastIN" target="_blank" style="font-weight: 600; color: white; text-decoration: none; font-size: 14px; padding: 0 10px;">Twitter/X</a>
                <a href="https://www.youtube.com/@weatherandclimate3749" target="_blank" style="font-weight: 600; color: white; text-decoration: none; font-size: 14px; padding: 0 10px;">YouTube</a>
            </div>

        </div>
    </body>
    </html>
    `;
};
