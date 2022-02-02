import fetchMock from "jest-fetch-mock";
import { updateRepo} from "../../lib/utils/sync_repo_utils";
import { API_ENDPOINT } from "../../lib/constants";
import { INVALID_TOKEN_JSON } from "../helpers/helpers";

describe('updateRepo', () => {
    beforeEach(() => {
        fetch.resetMocks();
    });

    const assertAPICall = (token="ACCESS_TOKEN") => {
        const url = `${API_ENDPOINT}/repos/REPO_ID`;
        expect(fetch.mock.calls[0][0]).toStrictEqual(url);
        const options = fetch.mock.calls[0][1];
        expect(options.method).toStrictEqual("PATCH");
        expect(options.headers).toStrictEqual({
            'Content-Type': 'application/json',
            'Authorization': `Basic ${token}`
        });
        const body = JSON.parse(fetch.mock.calls[0][1].body);
        expect(body).toStrictEqual({"is_in_sync" : false});
        return true;
    };

    test("with valid response", async () => {
        fetchMock.mockResponseOnce(JSON.stringify({}));
        const resp = await updateRepo("ACCESS_TOKEN", "REPO_ID", {"is_in_sync" : false});
        expect(resp.response).toStrictEqual({});
        expect(resp.error).toStrictEqual("");
        expect(assertAPICall()).toBe(true);
    });

    test("with auth error", async () => {
        const err = INVALID_TOKEN_JSON
        fetchMock.mockResponseOnce(JSON.stringify(err));
        const resp = await updateRepo("ACCESS_TOKEN", "REPO_ID", {"is_in_sync" : false});
        expect(resp.response).toStrictEqual({});
        expect(resp.error).toStrictEqual(err.error.message);
        expect(assertAPICall()).toBe(true);
    });

    test("will null response", async () => {
        fetchMock.mockResponseOnce(null);
        const resp = await updateRepo("ACCESS_TOKEN", "REPO_ID", {"is_in_sync" : false});
        expect(resp.error).toBeTruthy();
        expect(resp.response).toStrictEqual({});
        expect(assertAPICall()).toBe(true);
    });
});
