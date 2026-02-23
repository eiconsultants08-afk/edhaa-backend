import { sesClient } from "../utils.js";
import { SendEmailCommand } from "@aws-sdk/client-ses"; 
import { generateEmailBody } from "./template.js";

export const sendForecastEmail = async (subject, mailBody, additionalEmails = []) => {
    const emailBody = generateEmailBody(mailBody);
    
    const defaultEmails = [
        "skweathercast@gmail.com",
        "tsweathercast@gmail.com",
        "weathercastindia@gmail.com",
    ];
    const toAddresses = additionalEmails.length > 0 ? [...defaultEmails, ...additionalEmails] : defaultEmails;
    
    try {
        for (const email of toAddresses) {
            const params = {
                Destination: { ToAddresses: [email] },
                Message: {
                    Body: { Html: { Data: emailBody } }, // Send HTML email
                    Subject: { Data: subject },
                },
                Source: "admin@weathercastsolutions.com",
            };

            const command = new SendEmailCommand(params);
            const result = await sesClient.send(command);
            console.log(`Email sent to ${email}! Message ID: ${result.MessageId}`);
        }

        return { success: true, message: "All emails sent successfully!" };
    } catch (error) {
        console.error(`Failed to send email: ${error.message}`);
        throw error;
    }
};
