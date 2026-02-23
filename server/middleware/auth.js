import { constants } from "../constants.js";
import { checkToken } from "../utils.js";
import { getUserByCondition } from "../database/db.js";

function getAuthorizationHeader(req) {
    const authHeader = req.headers.authorization;
    return authHeader ? authHeader.split(' ')[1] : "";
}

function validatedRole(roles) {
    return async function(req, res, next) {
        try {
            const { user_id } = req;
            const user = await getUserByCondition({user_id});
            if (user !== null) {
                if (roles.includes(user.role)) {
                    next();
                } else {
                    res.status(401).send({
                        status: 401,
                        message: "Unauthorized to access this resource."
                    });
                }
            } else {
                res.status(400).send({
                    status: 400,
                    message: "User does not exists."
                });
            }
        } catch(err) {
            console.error(err);
            res.status(400).send({
                status: 400,
                message: "Validating roles failed."
            });
        }
    };
};

export function checkIfAdmin() {
    return validatedRole([constants.ADMIN]);
};

export function checkIfUser() {
    return validatedRole([constants.ADMIN, constants.TECHNICIAN, constants.SUPER_ADMIN]);
};

export function checkAuthorization(req, res, next) {
    try {
        const accessToken = getAuthorizationHeader(req);
        if (!accessToken) {
            res.status(400).send({
                status: 400,
                message: "Access Token is not present in the header."
            });
        } else {
            const decoded = checkToken(accessToken, constants.ACCESS_TOKEN_SECRET);
            req.user_id = decoded.user_id;
            req.org_id = decoded.org_id;
            next();
        }
    } catch(err) {
        console.error(err);
        res.status(400).send({
            status: 400,
            message: "Invalid access token."
        });
    }
};