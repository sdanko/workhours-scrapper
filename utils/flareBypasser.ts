import axios from 'axios';

export async function bypassFlare(url: string) {
  const postData = {
    cmd: 'request.get',
    url: url,
    maxTimeout: 60000,
  };

  const initialResponse = await axios.post(
    'http://localhost:20080/v1',
    postData,
    {
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

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
  } else if (responseData.solution && responseData.solution.response !== null) {
    return responseData.solution.response;
  } else {
    console.error('No valid solution response found:', responseData);
  }
}
