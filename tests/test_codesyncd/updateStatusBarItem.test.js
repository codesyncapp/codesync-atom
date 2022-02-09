/**
 * @jest-environment jsdom
 */
import untildify from "untildify";
import {DAEMON_MSG_TILE_ID, STATUS_BAR_MSGS} from "../../lib/constants";
import {buildAtomEnv, randomBaseRepoPath, randomRepoPath} from "../helpers/helpers";
import {statusBarMsgs} from "../../lib/codesyncd/utils";
import {daemonMessages} from "../../lib/views";


describe("updateStataBarItem",  () => {
    let statusBarItem;
    const baseRepoPath = randomBaseRepoPath();
    const tileItem = {
        item:
            {
                id: DAEMON_MSG_TILE_ID
            },
        destroy: jest.fn()
    }

    beforeEach(() => {
        statusBarItem = {
            getLeftTiles: jest.fn(),
            addLeftTile: jest.fn()
        }
        jest.clearAllMocks();
        untildify.mockReturnValue(baseRepoPath);
        buildAtomEnv();
        // atom.project.getPaths.mockReturnValue([repoPath]);
    });

    const assertCommon = (text=STATUS_BAR_MSGS.DEFAULT, times=1) => {
        const daemonMsgView = new daemonMessages({ text });
        const view = atom.views.getView(daemonMsgView);
        const priority = 1;
        expect(statusBarItem.addLeftTile).toHaveBeenCalledTimes(times);
        const tileData = statusBarItem.addLeftTile.mock.calls[0][0];
        expect(tileData).toStrictEqual({ item: view, priority });
        return true;
    };

    test('No Tiles', () => {
        statusBarItem.getLeftTiles.mockReturnValueOnce([])
        const statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
        statusBarMsgsHandler.update(statusBarItem, "text");
        assertCommon("text");
    });

    test('1 Tile', () => {
        statusBarItem.getLeftTiles.mockReturnValueOnce([tileItem])
        const statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
        statusBarMsgsHandler.update(statusBarItem, "text");
        assertCommon("text");
    });

    test('Auth Failed', () => {
        statusBarItem.getLeftTiles.mockReturnValueOnce([])
        const statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
        statusBarMsgsHandler.update(STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
        assertCommon(STATUS_BAR_MSGS.AUTHENTICATION_FAILED);
    });

    test('Connect Repo', () => {
        statusBarItem.getLeftTiles.mockReturnValueOnce([])
        const statusBarMsgsHandler = new statusBarMsgs(statusBarItem);
        statusBarMsgsHandler.update(STATUS_BAR_MSGS.CONNECT_REPO);
        assertCommon(STATUS_BAR_MSGS.CONNECT_REPO);
   });
});
