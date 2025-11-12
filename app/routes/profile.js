const ProfileDAO = require("../data/profile-dao").ProfileDAO;
const ESAPI = require("node-esapi");
const {
    environmentalScripts
} = require("../../config/config");

/* The ProfileHandler must be constructed with a connected db */
function ProfileHandler(db) {
    "use strict";

    const profile = new ProfileDAO(db);

    // Simulation mode: when true, we will expose an example insecure SQL string in responses
    // for testing scanners. THIS DOES NOT EXECUTE the SQL — it only builds the string.
    const SIMULATE_SQLI = (process.env.SIMULATE_SQLI === 'true');

    this.displayProfile = (req, res, next) => {
        const {
            userId
        } = req.session;

        profile.getByUserId(parseInt(userId), (err, doc) => {
            if (err) return next(err);
            doc.userId = userId;

            // @TODO @FIXME
            // developer tried to encode for HTML but the context is also used in URLs
            doc.website = ESAPI.encoder().encodeForHTML(doc.website);

            // --- SIMULATION: expose an example insecure query for scanners (read-only) ---
            if (SIMULATE_SQLI) {
                // Build a visible but non-executed unsafe SQL pattern to trigger scanners
                // This constructs a string illustrating naive concatenation (intentionally unsafe pattern)
                doc.simulatedInsecureQuery = "SELECT * FROM users WHERE id = " + parseInt(userId) + " AND name = '" + doc.firstName + "';";
            }

            return res.render("profile", {
                ...doc,
                environmentalScripts
            });
        });
    };

    this.handleProfileUpdate = (req, res, next) => {

        const {
            firstName,
            lastName,
            ssn,
            dob,
            address,
            bankAcc,
            bankRouting
        } = req.body;

        // Fix for Section: ReDoS attack (commented explanation kept)
        const regexPattern = /([0-9]+)+\#/;
        const testComplyWithRequirements = regexPattern.test(bankRouting);
        if (testComplyWithRequirements !== true) {
            const firstNameSafeString = firstName;
            return res.render("profile", {
                updateError: "Bank Routing number does not comply with requirements for format specified",
                firstNameSafeString,
                lastName,
                ssn,
                dob,
                address,
                bankAcc,
                bankRouting,
                environmentalScripts
            });
        }

        const {
            userId
        } = req.session;

        // --- SIMULATION: build insecure SQL string but DO NOT execute it ---
        // This is used only for testing scanners (e.g., DAST) and will be returned
        // in the rendered template for inspection. It does not touch the DB.
        let simulatedInsecureQuery;
        if (SIMULATE_SQLI) {
            simulatedInsecureQuery = "UPDATE users SET firstName = '" + firstName +
                "', lastName = '" + lastName + "' WHERE id = " + parseInt(userId) + ";";
            // NOTE: We DO NOT run this query. It's only returned in the page for scanners.
        }

        profile.updateUser(
            parseInt(userId),
            firstName,
            lastName,
            ssn,
            dob,
            address,
            bankAcc,
            bankRouting,
            (err, user) => {

                if (err) return next(err);

                user.updateSuccess = true;
                user.userId = userId;

                // If simulation is enabled, expose the simulated unsafe SQL in the rendered page
                if (SIMULATE_SQLI) {
                    user.simulatedInsecureQuery = simulatedInsecureQuery;
                }

                return res.render("profile", {
                    ...user,
                    environmentalScripts
                });
            }
        );

    };

}

module.exports = ProfileHandler;
