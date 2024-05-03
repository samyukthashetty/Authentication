
const express = require('express');
const bodyParser = require('body-parser');
const connection = require('./database');
const router = express.Router();
const authenticateToken = require('./auth');
router.use(bodyParser.json());

//CRUD OPERATIONS TO FETCH PRODUCTS
//create all the products

router.post('/products', authenticateToken, (req, res) => {
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


router.put('/products', authenticateToken, (req, res) => {
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
router.get('/products/:id', authenticateToken, (req, res) => {
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
router.delete('/products/:id', authenticateToken, (req, res) => {
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
router.put('/products/:id', authenticateToken, (req, res) => {
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


router.post('/productprofiles', authenticateToken, (req, res) => {
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
router.get('/productprofiles/:id', authenticateToken, (req, res) => {
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
router.delete('/productprofiles/:id', authenticateToken, (req, res) => {
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

router.put('/productprofiles/:id', authenticateToken, (req, res) => {
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


module.exports = router;
