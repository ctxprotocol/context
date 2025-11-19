export type WeatherQuery = {
  latitude?: number;
  longitude?: number;
  city?: string;
};

export type WeatherResult = {
  cityName?: string;
  current?: {
    temperatureCelsius: number;
  };
  hourly?: {
    times: string[];
    temperaturesCelsius: number[];
  };
  daily?: {
    sunrise: string[];
    sunset: string[];
  };
  raw: unknown;
};

async function geocodeCity(city: string) {
  const response = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`
  );

  if (!response.ok) {
    return null;
  }

  const data = await response.json();
  if (!data.results?.length) {
    return null;
  }

  const result = data.results[0];
  return {
    latitude: result.latitude as number,
    longitude: result.longitude as number,
  };
}

export async function getWeather(query: WeatherQuery): Promise<WeatherResult> {
  let latitude = query.latitude;
  let longitude = query.longitude;

  if (!latitude || !longitude) {
    if (!query.city) {
      throw new Error(
        "Please provide either a city name or both latitude and longitude."
      );
    }
    const coords = await geocodeCity(query.city);
    if (!coords) {
      throw new Error(`Could not find coordinates for "${query.city}".`);
    }
    latitude = coords.latitude;
    longitude = coords.longitude;
  }

  const response = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current=temperature_2m&hourly=temperature_2m&daily=sunrise,sunset&timezone=auto`
  );

  if (!response.ok) {
    throw new Error("Weather request failed");
  }

  const payload = await response.json();

  return {
    cityName: query.city,
    current: payload.current
      ? {
          temperatureCelsius: payload.current.temperature_2m,
        }
      : undefined,
    hourly: payload.hourly
      ? {
          times: payload.hourly.time as string[],
          temperaturesCelsius: payload.hourly.temperature_2m as number[],
        }
      : undefined,
    daily: payload.daily
      ? {
          sunrise: payload.daily.sunrise as string[],
          sunset: payload.daily.sunset as string[],
        }
      : undefined,
    raw: payload,
  };
}




