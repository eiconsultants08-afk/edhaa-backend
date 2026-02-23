import Auth from './apis/auth/route.js';
import Admin from './apis/admin/route.js';
import User from './apis/user/route.js';

const register = (app) => {
    app.use("/auth", Auth);
    app.use("/admin", Admin);
    app.use("/user", User);
};

export default register;