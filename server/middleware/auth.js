import { constants } from "../constants.js";
import { checkToken } from "../utils.js";
import { getUserById } from "../database/db.js";

function getAuthorizationHeader(req) {
    const authHeader = req.headers.authorization;
    return authHeader ? authHeader.split(' ')[1] : "";
}

function validatedRole(roles) {
    return async function(req, res, next) {
        try {
            const { id } = req;
            const user = await getUserById(id);
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
    return validatedRole([constants.ADMIN, constants.USER, constants.SUBADMIN, constants.ENERGY, constants.EADMIN, constants.EUSER, constants.POWER_ANALYST]);
};

export function checkIfEadmin() {
    return validatedRole([constants.ADMIN, constants.EADMIN]);
};

export function checkIfEnergyUser() {
    return validatedRole([constants.ADMIN, constants.ENERGY, constants.POWER_ANALYST]);
};

export function checkIfEUser() {
    return validatedRole([constants.ADMIN, constants.EUSER]);
};

export function checkIfSubAdmin() {
    return validatedRole([constants.ADMIN, constants.SUBADMIN]);
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
            req.id = decoded.id;
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