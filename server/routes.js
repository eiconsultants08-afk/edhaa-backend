import Auth from './apis/auth/route.js';
import Admin from './apis/admin/route.js';
import User from './apis/user/route.js';
import Technician from './apis/technician/route.js';
import SuperAdmin from './apis/superadmin/route.js'

const register = (app) => {
    app.use("/auth", Auth);
    app.use("/admin", Admin);
    app.use("/user", User);
    app.use("/technician", Technician);
     app.use("/superadmin", SuperAdmin);
};

export default register;