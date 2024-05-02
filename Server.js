const express = require('express');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const connection = require('./database');
const emailValidator = require('email-validator');
const validator = require('validator');

const app = express();
const port = 3000;

app.use(bodyParser.json());

const secretKey = 'secretkey'; 

function authenticateToken(req, res, next) {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];
  
  if (!token) {
    return res.status(401).json({ error: 'Unauthorized: Token missing' });
  }

  jwt.verify(token, secretKey, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Forbidden: Invalid token' });
    }
    req.user = user;
    next();
  });
}


app.post('/login', (req, res) => {
  const { firstname, password } = req.body;
  if(!firstname){
    return res.status(401).json({ error: 'Unauthorized: Incorrect credentials' });
  }
  // Authenticate user with database logic If valid credentials, generate token
  const token = jwt.sign({ firstname }, secretKey);
  res.json({ token });
});

// CRUD operations for users table

//fetch all the users

app.post('/users', authenticateToken, (req, res) => {
  const { firstname, lastname, email, password } = req.body;

  // Validate firstname and lastname
  if (typeof firstname !== 'string' || typeof lastname !== 'string') {
    return res.status(400).json({ error: 'Firstname and lastname must be strings' });
  }

  // Validate email format
  if (!emailValidator.validate(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

   // Validate password length
   if (password.length < 6) {
    return res.status(400).json({ error: 'Password must be at least 6 characters long' });
  }

  const newUser = { firstname, lastname, email, password };

  connection.query('INSERT INTO user SET ?', newUser, (error, results) => {
    if (error) {
      console.error('Error creating user:', error);
      return res.status(500).json({ error: 'An error occurred while creating user' });
    }

    if (results.affectedRows === 0) {
      // If no rows were affected, it means insertion failed
      return res.status(500).json({ error: 'Failed to create user' });
    }

    res.json({ message: 'User created successfully' });
  });
});

//fetch all users and profile
app.put('/users', authenticateToken, (req, res) => {
  const { page, limit, firstname } = req.body; 

  // Validate page and limit parameters
  const pageNumber = parseInt(page);
  const itemsPerPage = parseInt(limit);
  if (isNaN(pageNumber) || isNaN(itemsPerPage) || pageNumber <= 0 || itemsPerPage <= 0) {
    return res.status(400).json({ error: 'Invalid page or limit parameters' });
  }

  // Calculate offset for pagination
  const offset = (pageNumber - 1) * itemsPerPage;

  let countQuery = 'SELECT COUNT(*) as total FROM user';
  let dataQuery = 'SELECT user.*, user_profile.age, user_profile.address, user_profile.contact_number, user_profile.pnn_number FROM user LEFT JOIN user_profile ON user.user_id = user_profile.user_id';

  const queryParams = [];

  // Add search condition for firstname only if it's provided
  if (firstname) {
    countQuery += ' WHERE user.firstname LIKE ?';
    dataQuery += ' WHERE user.firstname LIKE ?';
    queryParams.push(`%${firstname}%`);
  }

  // Add LIMIT and OFFSET to data query
  dataQuery += ' LIMIT ? OFFSET ?';
  queryParams.push(itemsPerPage, offset);

  connection.query(countQuery, queryParams, (error, countResult) => {
    if (error) {
      console.error('Error fetching total user count:', error);
      return res.status(500).json({ error: 'An error occurred while fetching total user count' });
    }

    const total = countResult[0].total;

    connection.query(dataQuery, queryParams, (error, results) => {
      if (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'An error occurred while fetching users' });
      }
      
      const totalPages = Math.ceil(total / itemsPerPage);

      res.json({
        page: pageNumber,
        limit: itemsPerPage,
        totalPages,
        total,
        users: results
      });
    });
  });
});


//fetching usr by id
app.get('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Validate user ID parameter
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  connection.query('SELECT * FROM user WHERE user_id = ?', userId, (error, results) => {
    if (error) {
      console.error('Error fetching user by ID:', error);
      return res.status(500).json({ error: 'An error occurred while fetching user by ID' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(results[0]);
  });
});

//delete the user
app.delete('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;

  // Validate user ID parameter
  if (isNaN(userId) || userId <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  connection.query('DELETE FROM user WHERE user_id = ?', userId, (error, results) => {
    if (error) {
      console.error('Error deleting user by ID:', error);
      return res.status(500).json({ error: 'An error occurred while deleting user by ID' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ message: 'User deleted successfully' });
  });
});


//update the users
app.put('/users/:id', authenticateToken, (req, res) => {
  const userId = req.params.id;
  const updatedUserData = req.body;

  // Check if updated user data is provided in the request body
  if (!updatedUserData || Object.keys(updatedUserData).length === 0) {
    res.status(400).json({ error: 'No data provided for update' });
    return;
  }

  connection.query('SELECT * FROM user WHERE user_id = ?', userId, (error, results) => {
    if (error) {
      console.error('Error fetching user data:', error);
      res.status(500).json({ error: 'An error occurred while fetching user data' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const existingUserData = results[0];
    const mergedUserData = { ...existingUserData, ...updatedUserData };

    connection.query('UPDATE user SET ? WHERE user_id = ?', [mergedUserData, userId], (error, updateResult) => {
      if (error) {
        console.error('Error updating user data:', error);
        res.status(500).json({ error: 'An error occurred while updating user data' });
        return;
      }
      
      if (updateResult.affectedRows === 0) {
        res.status(500).json({ error: 'User data not updated' });
        return;
      }

      res.json({ message: 'User updated successfully' });
    });
  });
});

// CRUD operations for userprofile table

// Create a new user profile


app.post('/userprofiles', authenticateToken, (req, res) => {
  const { user_id, age, address, contact_number, pnn_number } = req.body;

  // Check if all required fields are present
  if (!user_id || !age || !address || !contact_number || !pnn_number) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Validate user_id and age
  if (!Number.isInteger(user_id) || !Number.isInteger(age)) {
    return res.status(400).json({ error: 'User ID and age must be integers' });
  }

  // Validate address as string
  if (typeof address !== 'string') {
    return res.status(400).json({ error: 'Address must be a string' });
  }

  // Validate contact_number format
  if (!validator.isMobilePhone(contact_number, 'any', { strictMode: true })) {
    return res.status(400).json({ error: 'Invalid contact number format' });
  }

  // Validate pnn_number format
  if (!validator.isPostalCode(pnn_number, 'any')) {
    return res.status(400).json({ error: 'Invalid PIN code format' });
  }

  // Check if the user exists
  connection.query('SELECT * FROM user WHERE user_id = ?', user_id, (error, results) => {
    if (error) {
      console.error('Error checking user existence:', error);
      return res.status(500).json({ error: 'An error occurred while checking user existence' });
    }
    if (results.length === 0) {
      // User does not exist, return an error
      return res.status(404).json({ error: 'User does not exist. Create the user first.' });
    }

    // Proceed with inserting the user profile data into the database
    const userProfileData = { user_id, age, address, contact_number, pnn_number };
    connection.query('INSERT INTO user_profile SET ?', userProfileData, (error, results) => {
      if (error) {
        console.error('Error creating user profile:', error);
        return res.status(500).json({ error: 'An error occurred while creating user profile' });
      }
      res.json({ message: 'User profile created successfully' });
    });
  });
});




// Get user profile by ID
app.get('/userprofiles/:id', authenticateToken, (req, res) => {
  const userProfileId = req.params.id;

  // Validate user profile ID parameter
  if (isNaN(userProfileId) || userProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid user profile ID' });
  }

  connection.query('SELECT * FROM user_profile WHERE user_id = ?', userProfileId, (error, results) => {
    if (error) {
      console.error('Error fetching user profile by ID:', error);
      return res.status(500).json({ error: 'An error occurred while fetching user profile by ID' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json(results[0]);
  });
});


// Delete user profile by ID
app.delete('/userprofiles/:id', authenticateToken, (req, res) => {
  const userProfileId = req.params.id;

  // Validate user profile ID parameter
  if (isNaN(userProfileId) || userProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid user profile ID' });
  }

  connection.query('DELETE FROM user_profile WHERE user_id = ?', userProfileId, (error, results) => {
    if (error) {
      console.error('Error deleting user profile by ID:', error);
      return res.status(500).json({ error: 'An error occurred while deleting user profile by ID' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    res.json({ message: 'User profile deleted successfully' });
  });
});

// Update user profile by ID

app.put('/userprofiles/:id', authenticateToken, (req, res) => {
  const userProfileId = req.params.id;
  const updatedProfileData = req.body;

  // Validate user profile ID parameter
  if (isNaN(userProfileId) || userProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid user profile ID' });
  }

  connection.query('SELECT * FROM user_profile WHERE user_id = ?', userProfileId, (error, results) => {
    if (error) {
      console.error('Error fetching user profile data:', error);
      return res.status(500).json({ error: 'An error occurred while fetching user profile data' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'User profile not found' });
    }

    const existingProfileData = results[0];
    const mergedProfileData = { ...existingProfileData, ...updatedProfileData };

    connection.query('UPDATE user_profile SET ? WHERE user_id = ?', [mergedProfileData, userProfileId], (error, updateResult) => {
      if (error) {
        console.error('Error updating user profile data:', error);
        return res.status(500).json({ error: 'An error occurred while updating user profile data' });
      }
      
      res.json({ message: 'User profile updated successfully' });
    });
  });
});
//CRUD OPERATIONS TO FETCH PRODUCTS
//create all the products

app.post('/products', authenticateToken, (req, res) => {
  const {ProductID , ProductName, Category, Price } = req.body;

  // Validate productname and category
  if (typeof ProductName !== 'string' || typeof Category !== 'string') {
    return res.status(400).json({ error: 'Productname  and category must be strings' });
  }

  const newUser = { ProductID , ProductName, Category, Price};

  connection.query('INSERT INTO Product SET ?', newUser, (error, results) => {
    if (error) {
      console.error('Error creating product:', error);
      return res.status(500).json({ error: 'An error occurred while creating products' });
    }

    if (results.affectedRows === 0) {
      // If no rows were affected, it means insertion failed
      return res.status(500).json({ error: 'Failed to create products' });
    }

    res.json({ message: 'Product created successfully' });
  });
});

//Fetch all products and their profile


app.put('/products', authenticateToken, (req, res) => {
  const { page, limit, ProductName } = req.body; 

  // Validate page and limit parameters
  const pageNumber = parseInt(page);
  const itemsPerPage = parseInt(limit);
  if (isNaN(pageNumber) || isNaN(itemsPerPage) || pageNumber <= 0 || itemsPerPage <= 0) {
    return res.status(400).json({ error: 'Invalid page or limit parameters' });
  }

  // Calculate offset for pagination
  const offset = (pageNumber - 1) * itemsPerPage;

  let countQuery = 'SELECT COUNT(*) as total FROM product';
  let dataQuery = 'SELECT product.*, ProductProfile.ProductID, ProductProfile.Ratings, ProductProfile.Color, ProductProfile.Brand FROM product LEFT JOIN ProductProfile ON product.ProductID = ProductProfile.ProductID';

  const queryParams = [];

  // Add search condition for productname only if it's provided
  if (ProductName) {
    countQuery += ' WHERE product.ProductName LIKE ?';
    dataQuery += ' WHERE product.ProductName LIKE ?';
    queryParams.push(`%${ProductName}%`);
  }

  // Add LIMIT and OFFSET to data query
  dataQuery += ' LIMIT ? OFFSET ?';
  queryParams.push(itemsPerPage, offset);

  connection.query(countQuery, queryParams, (error, countResult) => {
    if (error) {
      console.error('Error fetching total user count:', error);
      return res.status(500).json({ error: 'An error occurred while fetching total product count' });
    }

    const total = countResult[0].total;

    connection.query(dataQuery, queryParams, (error, results) => {
      if (error) {
        console.error('Error fetching users:', error);
        return res.status(500).json({ error: 'An error occurred while fetching products' });
      }
      
      const totalPages = Math.ceil(total / itemsPerPage);

      res.json({
        page: pageNumber,
        limit: itemsPerPage,
        totalPages,
        total,
        users: results
      });
    });
  });
});
//fetching product by id
app.get('/products/:id', authenticateToken, (req, res) => {
  const ProductID = req.params.id;

  // Validate product ID parameter
  if (isNaN(ProductID) || ProductID <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  connection.query('SELECT * FROM product WHERE ProductID = ?', ProductID, (error, results) => {
    if (error) {
      console.error('Error fetching user by ID:', error);
      return res.status(500).json({ error: 'An error occurred while fetching user by ID' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json(results[0]);
  });
});

//delete the product
app.delete('/products/:id', authenticateToken, (req, res) => {
  const ProductID = req.params.id;

  // Validate product ID parameter
  if (isNaN(ProductID) || ProductID <= 0) {
    return res.status(400).json({ error: 'Invalid user ID' });
  }

  connection.query('DELETE FROM product WHERE ProductID = ?', ProductID, (error, results) => {
    if (error) {
      console.error('Error deleting user by ID:', error);
      return res.status(500).json({ error: 'An error occurred while deleting user by ID' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'Product not found' });
    }

    res.json({ message: 'product deleted successfully' });
  });
});


//update the product
app.put('/products/:id', authenticateToken, (req, res) => {
  const ProductID = req.params.id;
  const updatedProductData = req.body;

  // Check if updated product data is provided in the request body
  if (!updatedProductData || Object.keys(updatedProductData).length === 0) {
    res.status(400).json({ error: 'No data provided for update' });
    return;
  }

  connection.query('SELECT * FROM product WHERE ProductID = ?', ProductID, (error, results) => {
    if (error) {
      console.error('Error fetching product data:', error);
      res.status(500).json({ error: 'An error occurred while fetching product data' });
      return;
    }

    if (results.length === 0) {
      res.status(404).json({ error: 'product not found' });
      return;
    }

    const existingProductData = results[0];
    const mergedProductData = { ...existingProductData, ...updatedProductData };

    connection.query('UPDATE product SET ? WHERE ProductID = ?', [mergedProductData, ProductID], (error, updateResult) => {
      if (error) {
        console.error('Error updating product data:', error);
        res.status(500).json({ error: 'An error occurred while updating product data' });
        return;
      }
      
      if (updateResult.affectedRows === 0) {
        res.status(500).json({ error: 'product data not updated' });
        return;
      }

      res.json({ message: 'product updated successfully' });
    });
  });
});

// CRUD operations for productprofile table

// Create a new product profile


app.post('/productprofiles', authenticateToken, (req, res) => {
  const { ProductID, Ratings, Color, Brand} = req.body;

  // Check if all required fields are present
  if (!ProductID || !Ratings || !Color || !Brand) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  // Validate productid
  if (!Number.isInteger(ProductID) ) {
    return res.status(400).json({ error: 'product ID must be integers' });
  }

  // Validate color and brand as string
  if (typeof Color!== 'string' || typeof Brand!== 'string') {
    return res.status(400).json({ error: 'color and brand must be a string' });
  }

  
  // Check if the product exists
  connection.query('SELECT * FROM product WHERE ProductID = ?', ProductID, (error, results) => {
    if (error) {
      console.error('Error checking product existence:', error);
      return res.status(500).json({ error: 'An error occurred while checking product existence' });
    }
    if (results.length === 0) {
      // product does not exist, return an error
      return res.status(404).json({ error: 'product does not exist. Create the product first.' });
    }

    // Proceed with inserting the product profile data into the database
    const productProfileData = { ProductID, Ratings, Color, Brand };
    connection.query('INSERT INTO ProductProfile SET ?', productProfileData, (error, results) => {
      if (error) {
        console.error('Error creating product profile:', error);
        return res.status(500).json({ error: 'An error occurred while creating product profile' });
      }
      res.json({ message: 'product profile created successfully' });
    });
  });
});

// Get productprofile by ID
app.get('/productprofiles/:id', authenticateToken, (req, res) => {
  const productProfileId = req.params.id;

  // Validate user profile ID parameter
  if (isNaN(productProfileId) || productProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid user profile ID' });
  }

  connection.query('SELECT * FROM ProductProfile WHERE ProductID = ?', productProfileId, (error, results) => {
    if (error) {
      console.error('Error fetching product profile by ID:', error);
      return res.status(500).json({ error: 'An error occurred while fetching product profile by ID' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'product profile not found' });
    }

    res.json(results[0]);
  });
});


// Delete product profile by ID
app.delete('/productprofiles/:id', authenticateToken, (req, res) => {
  const productProfileId = req.params.id;

  // Validate product profile ID parameter
  if (isNaN(productProfileId) || productProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid product profile ID' });
  }

  connection.query('DELETE FROM ProductProfile WHERE ProductID = ?', productProfileId, (error, results) => {
    if (error) {
      console.error('Error deleting product profile by ID:', error);
      return res.status(500).json({ error: 'An error occurred while deleting product profile by ID' });
    }

    if (results.affectedRows === 0) {
      return res.status(404).json({ error: 'product profile not found' });
    }

    res.json({ message: 'Prduct profile deleted successfully' });
  });
});

// Update product profile by ID

app.put('/productprofiles/:id', authenticateToken, (req, res) => {
  const productProfileId = req.params.id;
  const updatedProfileData = req.body;

  // Validate user profile ID parameter
  if (isNaN(productProfileId) || productProfileId <= 0) {
    return res.status(400).json({ error: 'Invalid product profile ID' });
  }

  connection.query('SELECT * FROM ProductProfile WHERE ProductID = ?', productProfileId, (error, results) => {
    if (error) {
      console.error('Error fetching product profile data:', error);
      return res.status(500).json({ error: 'An error occurred while fetching product profile data' });
    }

    if (results.length === 0) {
      return res.status(404).json({ error: 'product profile not found' });
    }

    const existingProfileData = results[0];
    const mergedProfileData = { ...existingProfileData, ...updatedProfileData };

    connection.query('UPDATE ProductProfile SET ? WHERE ProductID = ?', [mergedProfileData, productProfileId], (error, updateResult) => {
      if (error) {
        console.error('Error updating product profile data:', error);
        return res.status(500).json({ error: 'An error occurred while product user profile data' });
      }
      
      res.json({ message: 'product profile updated successfully' });
    });
  });
});




// Start the server
app.listen(port, () => {
  console.log(`Server is listening at http://localhost:${port}`);
});

module.exports = app;
