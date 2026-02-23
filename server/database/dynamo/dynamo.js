import AWS from 'aws-sdk';
import util from 'util';
import moment from 'moment-timezone';

AWS.config.update({ region: 'ap-south-1' });

const dynamoDB = new AWS.DynamoDB.DocumentClient();
const tableName = 'logs';

const scanAsync = util.promisify(dynamoDB.scan).bind(dynamoDB);

export async function getDynamoDbData(startDate, endDate, project) {
  const params = {
    TableName: tableName,
  };
  try {
    const data = await scanAsync(params);

    const startDates = moment(startDate).utc(); // Example UTC startDate
    const endDates = moment(endDate).utc();   // Example UTC endDate

    const filteredData = data.Items.filter(item => {

        // Convert item.timestamp string to Date object and then to UTC
        const itemDate = moment.utc(item.timestamp);
        
        console.log(itemDate, startDates, endDates);
        // Compare itemDate with startDates and endDates
        return itemDate.isSameOrAfter(startDates) && itemDate.isSameOrBefore(endDates);
    });


    if (project) {
      return filteredData.filter(item => item.project === project);
    }
    
    return filteredData;
  } catch (error) {
    console.error('Error fetching data from DynamoDB:', error);
    throw error;
  }
}

