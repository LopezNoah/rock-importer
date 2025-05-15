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
    // DB: D1Database; // Removed
    ROCK_API_URL: string;
    ROCK_API_KEY: string;
    ROCK_PERSON_ATTRIBUTE_KEY: string;
    ROCK_PERSON_ATTRIBUTE_VALUE: string;
}

async function rockFetch(env: Env, path: string, options: RequestInit = {}): Promise<Response> {
    const url = `${env.ROCK_API_URL.replace(/\/$/, '')}/${path.replace(/^\//, '')}`;
    const headers = {
        'Authorization-Token': env.ROCK_API_KEY,
        'Content-Type': 'application/json',
        ...options.headers,
    };
    console.log(env.ROCK_API_KEY, env.ROCK_API_URL)
    return fetch(url, { ...options, headers });
}

export async function findPersonInRock(env: Env, firstName: string, lastName: string, email: string): Promise<RockPerson | null> {
    let filter = `Email eq '${email.replace(/'/g, "''")}'`;
    if (!email && firstName && lastName) {
        filter = `FirstName eq '${firstName.replace(/'/g, "''")}' and LastName eq '${lastName.replace(/'/g, "''")}'`;
    } else if (!email) { // if only email is blank and no names, this won't find much
        return null;
    }
    // Consider a more robust search if needed, e.g., checking all three fields
    filter = `(Email eq '${email.replace(/'/g, "''")}') and (FirstName eq '${firstName.replace(/'/g, "''")}') and (LastName eq '${lastName.replace(/'/g, "''")}')`

    const response = await rockFetch(env, `People?$filter=${encodeURIComponent(filter)}`);

    if (!response.ok) {
        console.error(`Rock API Error (findPerson): ${response.status} ${await response.text()}`);
        throw new Error(`Rock API Error (findPerson): ${response.status}`);
    }
    const people: RockPerson[] = await response.json();
    return people.length > 0 ? people[0] : null;
}

export async function createPersonInRock(env: Env, firstName: string, lastName: string, email: string): Promise<void> {
    const personData = 
    {
        FirstName: firstName,
        LastName: lastName,
        NickName: firstName,
        Email: email,
        Gender: 0,
        IsDeceased: false,
        EmailPreference: 0,
        RecordTypeValueId: 1,
        CommunicationPreference: 1,
        AgeClassification: 0,
        IsLockedAsChild: false,
        AccountProtectionProfile: 0,
        IsSystem: false,
    };
    console.log(JSON.stringify(personData));

    const response = await rockFetch(env, 'People', {
        method: 'POST',
        body: JSON.stringify(personData)
    });
    console.log(response.status);
    console.log(await response.text());

    if (response.status === 201 || response.status === 200) {
        const responseText = await response.text();
        let newPersonId: number;
        try {
            newPersonId = parseInt(responseText, 10);
            if (isNaN(newPersonId)) {
                 const jsonResponse = JSON.parse(responseText);
                 newPersonId = jsonResponse.Id || jsonResponse.id;
            }
        } catch (e) {
            throw new Error('Failed to parse ID from Rock person creation response.');
        }
        
        if (!newPersonId || isNaN(newPersonId)) {
             throw new Error('No ID returned from Rock person creation.');
        }

        const getResponse = await rockFetch(env, `People/${newPersonId}`);
        const updatePersonAttribute = await updatePersonAttributeInRock(env, newPersonId, 'ImportedFrom', 'CSV_Import_2025_05_14')
        if (!getResponse.ok) {
            console.error(`Rock API Error (fetch created Person): ${getResponse.status} ${await getResponse.text()}`);
            throw new Error('Failed to fetch newly created person from Rock.');
        }
        return await getResponse.json();
    } else {
        const errorBody = await response.text();
        console.error(`Rock API Error (createPerson): ${response.status} ${errorBody}`);
        throw new Error(`Rock API Error (createPerson): ${response.status} - ${errorBody}`);
    }
}

export async function updatePersonAttributeInRock(
    env: Env,
    personId: number,
    attributeKey: string,
    attributeValue: string
): Promise<void> {
    const url = `People/AttributeValue/${personId}?attributeKey=${encodeURIComponent(attributeKey)}&attributeValue=${encodeURIComponent(attributeValue)}`;

    // const response = await rockFetch(env, url, {
    //     method: 'POST'
    // });

    console.log(`Updated person attribute: ${ personId }`);
    // if (!response.ok) {
    //     const errorBody = await response.text();
    //     console.error(`Rock API Error (updatePersonAttribute): ${response.status} ${errorBody}`);
    //     throw new Error(`Rock API Error (updatePersonAttribute): ${response.status} - ${errorBody}`);
    // }
}