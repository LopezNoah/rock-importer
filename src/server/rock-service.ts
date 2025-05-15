// src/server/rock-service.ts
export interface RockPerson {
    Id: number;
    FirstName: string;
    LastName: string;
    Email: string;
    AttributeValues?: { [key: string]: { Value: string | number | boolean } };
}

// Updated Env type
export interface Env {
    ROCK_API_URL: string;
    ROCK_API_KEY: string;
}

async function rockFetch(env: Env, path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${env.ROCK_API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const headers = {
        'Authorization-Token': env.ROCK_API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
    };
    // console.log('Rock Fetch URL:', url);
    // console.log('Rock Fetch Options:', JSON.stringify(options));
    // console.log('Rock API Key (first 5 chars):', env.ROCK_API_KEY ? env.ROCK_API_KEY.substring(0,5) : 'NOT SET');
    return fetch(url, { ...options, headers });
}

export async function findPersonInRock(env: Env, firstName: string, lastName: string, email: string): Promise<RockPerson | null> {
    let filter = `(Email eq '${email.replace(/'/g, "''")}')`;
    if (firstName && lastName) { // Add name check if available, making email primary
        filter += ` and (FirstName eq '${firstName.replace(/'/g, "''")}') and (LastName eq '${lastName.replace(/'/g, "''")}')`;
    } else if (!email) { // If email is blank, this logic path might be problematic. Ensure email is always primary key for lookup.
        // Fallback to name if email is truly not provided, though UI usually requires it.
        if (firstName && lastName) {
             filter = `(FirstName eq '${firstName.replace(/'/g, "''")}') and (LastName eq '${lastName.replace(/'/g, "''")}')`;
        } else {
            return null; // Not enough info to search
        }
    }
    
    const response = await rockFetch(env, `People?$filter=${encodeURIComponent(filter)}`);

    if (!response.ok) {
        const errorText = await response.text();
        console.error(`Rock API Error (findPerson): ${response.status} ${errorText}`);
        throw new Error(`Rock API Error (findPerson): ${response.status} - ${errorText}`);
    }
    const people: RockPerson[] = await response.json();
    return people.length > 0 ? people[0] : null;
}

export async function createPersonInRock(
    env: Env,
    firstName: string,
    lastName: string,
    email: string,
    attributeKey: string,
    attributeValue: string
): Promise<RockPerson> {
    const personData = {
        FirstName: firstName,
        LastName: lastName,
        NickName: firstName, // Default NickName to FirstName
        Email: email,
        IsSystem: false,
        Gender: 0, // Unknown
        RecordStatusValueId: 2, // Active
        ConnectionStatusValueId: 138, // Prospective (Example, adjust as needed)
        EmailPreference: 0, // EmailAllowed
        // Add other required fields by your Rock instance if any
    };

    const createResponse = await rockFetch(env, 'People', {
        method: 'POST',
        body: JSON.stringify(personData)
    });

    if (!(createResponse.status === 201 || createResponse.status === 200)) { // 201 Created, 200 OK (if it returns the object)
        const errorBody = await createResponse.text();
        console.error(`Rock API Error (createPerson): ${createResponse.status} ${errorBody}`);
        throw new Error(`Rock API Error (createPerson): ${createResponse.status} - ${errorBody}`);
    }

    let newPersonId: number;
    const responseText = await createResponse.text();
    try {
        // Rock typically returns just the ID as plain text for POST /People
        newPersonId = parseInt(responseText, 10);
        if (isNaN(newPersonId)) {
            // If it's not a plain ID, it might be a JSON object (less common for POST /People)
            const jsonResponse = JSON.parse(responseText);
            newPersonId = jsonResponse.Id || jsonResponse.id;
        }
    } catch (e) {
        throw new Error('Failed to parse ID from Rock person creation response: ' + responseText);
    }
    
    if (!newPersonId || isNaN(newPersonId)) {
         throw new Error('No valid ID returned from Rock person creation: ' + responseText);
    }

    // Set the attribute for the new person
    await updatePersonAttributeInRock(env, newPersonId, attributeKey, attributeValue);
    
    // Fetch the newly created and (potentially) attribute-updated person details
    const getResponse = await rockFetch(env, `People/${newPersonId}`);
    if (!getResponse.ok) {
        const errorText = await getResponse.text();
        console.error(`Rock API Error (fetch created Person): ${getResponse.status} ${errorText}`);
        // Even if fetching fails, the person was created and attribute *attempted* to be set.
        // We could throw, or return a partial object with just the ID. For consistency, let's throw.
        throw new Error(`Failed to fetch newly created person (ID: ${newPersonId}) from Rock after setting attribute. Error: ${getResponse.status} - ${errorText}`);
    }
    const createdPerson: RockPerson = await getResponse.json();
    return createdPerson;
}

export async function updatePersonAttributeInRock(
    env: Env,
    personId: number,
    attributeKey: string,
    attributeValue: string
): Promise<void> {
    // The endpoint for setting attribute values is typically:
    // POST /api/AttributeValues
    // Body: { IsSystem: false, AttributeId: {{attributeId}}, EntityId: {{personId}}, Value: "{{attributeValue}}" }
    // This requires knowing the AttributeId for the attributeKey.
    // The provided URL `People/AttributeValue/...` seems like a custom or simplified endpoint.
    // Assuming `POST People/AttributeValue/{PersonId}?attributeKey=X&attributeValue=Y` is a valid endpoint for your Rock instance.
    const url = `People/AttributeValue/${personId}?attributeKey=${encodeURIComponent(attributeKey)}&attributeValue=${encodeURIComponent(attributeValue)}`;

    const response = await rockFetch(env, url, {
        method: 'POST', // Or PUT, depending on the specific Rock endpoint
        // Body might be needed if the query string method isn't supported for POST
        // body: JSON.stringify({ Value: attributeValue }) // Example if body is needed
    });

    console.log(`Attempted to update/set person attribute for ID ${personId}: Key='${attributeKey}', Value='${attributeValue}'. Status: ${response.status}`);

    if (!response.ok) {
        const errorBody = await response.text();
        console.error(`Rock API Error (updatePersonAttribute): ${response.status} ${errorBody}`);
        throw new Error(`Rock API Error (updatePersonAttribute for PersonID ${personId}, Key ${attributeKey}): ${response.status} - ${errorBody}`);
    }
    // Some Rock attribute updates might return 204 No Content on success
    if (response.status === 204) {
        return;
    }
    // Check if response has content before trying to parse
    const responseText = await response.text();
    if (responseText) {
        try {
            // Potentially parse if there's a meaningful JSON response
            // JSON.parse(responseText); 
        } catch (e) {
            console.warn("Could not parse JSON from updatePersonAttribute response:", responseText);
        }
    }
}