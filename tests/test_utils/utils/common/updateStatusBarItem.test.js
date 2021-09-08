/**
 * @jest-environment jsdom
 */
import {updateStatusBarItem} from "../../../../lib/utils/common";
import {DAEMON_MSG_TILE_ID} from "../../../../lib/constants";
import {buildAtomEnv} from "../../../helpers/helpers";


describe("updateStatusBarItem",  () => {

    const tileItem = {
        item:
            {
                id: DAEMON_MSG_TILE_ID
            },
        destroy: jest.fn()
    }
    beforeEach(() => {
        buildAtomEnv();
        jest.clearAllMocks();
    });

    test('No Tiles', () => {
        const statusBarItem = {
            getLeftTiles: jest.fn(),
            addLeftTile: jest.fn()
        }
        statusBarItem.getLeftTiles.mockReturnValueOnce([])
        updateStatusBarItem(statusBarItem, "text");
        expect(statusBarItem.addLeftTile).toHaveBeenCalledTimes(1);

    });

    test('1 Tile', () => {
        const statusBarItem = {
            getLeftTiles: jest.fn(),
            addLeftTile: jest.fn()
        }
        statusBarItem.getLeftTiles.mockReturnValueOnce([tileItem])
        updateStatusBarItem(statusBarItem, "text");
        expect(statusBarItem.addLeftTile).toHaveBeenCalledTimes(1);
    });

// test('updateStatusBarItem for Auth Failed', () => {
//     updateStatusBarItem(statusBarItem, STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
//     expect(statusBarItem.text).toEqual(STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
//     expect(statusBarItem.command).toEqual(COMMAND.triggerSignUp);
// });
//
// test('updateStatusBarItem with Connect Repo', () => {
//     updateStatusBarItem(statusBarItem, STATUS_BAR_MSGS.CONNECT_REPO);
//     expect(statusBarItem.text).toEqual(STATUS_BAR_MSGS.CONNECT_REPO);
//     expect(statusBarItem.command).toEqual(COMMAND.triggerSync);
// });

});
