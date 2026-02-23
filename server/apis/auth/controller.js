import { getToken, checkToken, checkPassword, checkExpiresIn } from "../../utils.js";
import { constants } from "../../constants.js";
import { getUserByUsername, updateToken, verifyToken, removeToken } from "../../database/db.js";

function generateTokens(payload) {
    const accessToken = getToken(payload, constants.ACCESS_TOKEN_SECRET, constants.EXPIRY_ACCESS_TOKEN);
    const refreshToken = getToken(payload, constants.REFRESH_TOKEN_SECRET, constants.EXPIRY_REFRESH_TOKEN);
    return {
        accessToken: accessToken,
        refreshToken: refreshToken
    };
}

export async function login(req, res) {
    try {
        const { username, password } = req.body;
        
        const user = await getUserByUsername(username);
        
        const isCorrect = await checkPassword(password, user.password);
        if (isCorrect) {
            const data = generateTokens({
                id: user.user_id,
                role: user.role,
                org_id: user.org_id,
            });
            console.log(user);
            
            await updateToken(user.user_id, user.org_id, data.refreshToken);
            res.status(200).send({
                status: 200,
                data: data,
                message: "User logged in successfully."
            });
        } else {
            res.status(401).send({
                status: 401,
                message: "Invalid login credentials."
            });
        }
    } catch(err) {
        console.error(err);
        res.status(400).send({
            status: 400,
            message: "User login failed."
        });
    }
};

export async function refresh(req, res) {
    try {
        const { refreshToken } = req.body;
        const decoded = checkToken(refreshToken, constants.REFRESH_TOKEN_SECRET);
        const isValid = await verifyToken(decoded.id,decoded.org_id, refreshToken);
        if (isValid) {
            const data = generateTokens({
                id: decoded.id,
                role: decoded.role,
                org_id: decoded.org_id
            });
            if (checkExpiresIn(decoded.exp, constants.EXPIRES_IN)) {
                await updateToken(decoded.id, decoded.org_id, data.refreshToken);
            } else {
                delete data.refreshToken;
            }
            res.status(200).send({
                status: 200,
                data: data,
                message: "New refresh token generated successfully."
            });
        } else {
            res.status(401).send({
                status: 401,
                message: "Invalid refresh token."
            });
        }
    } catch(err) {
        console.error(err);
        res.status(400).send({
            status: 400,
            message: "Refreshing token failed."
        });
    }
};

export async function logout(req, res) {
    try {
        const { id, org_id } = req;
        await removeToken(id, org_id);
        res.status(200).send({
            status: 200,
            message: "User logout successfully."
        });
    } 
    catch(err) {
        console.error(err);
        res.status(400).send({
            status: 400,
            message: "User logging out failed."
        });
    }
};