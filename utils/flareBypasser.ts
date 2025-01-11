import axios from 'axios';

export async function bypassFlare(url: string) {
  try {
    const postData = {
      cmd: 'request.get',
      url: url,
      maxTimeout: 60000,
    };

    const flareUrl = process.env.FLARE_BYPASSER_URL as string;
    const initialResponse = await axios.post(flareUrl, postData, {
      timeout: 60000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    const responseData = initialResponse.data;

    if (responseData.solution && responseData.solution.response === null) {
      console.log('Challenge solved, making follow-up request.');

      // Extract cookies
      const cookies = responseData.solution.cookies
        .map(
          (cookie: { name: string; value: string }) =>
            `${cookie.name}=${cookie.value}`
        )
        .join('; ');

      // Make the follow-up request with cookies
      const followUpResponse = await axios.get(responseData.solution.url, {
        headers: {
          Cookie: cookies,
          'User-Agent': responseData.solution.userAgent, // Set user-agent from response
        },
      });

      return followUpResponse.data;
    } else if (
      responseData.solution &&
      responseData.solution.response !== null
    ) {
      return responseData.solution.response;
    } else {
      console.error('No valid solution response found:', responseData);
      return null;
    }
  } catch (error) {
    console.error('Flare Bypasser error:', error);
    return null;
  }
}
